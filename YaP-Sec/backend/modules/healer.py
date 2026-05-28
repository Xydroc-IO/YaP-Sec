from __future__ import annotations

import asyncio
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any

from modules import auditor

SNAPSHOT_ROOT = Path("/tmp/yapsec-healer-snapshots")
SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)

LOW_RISK_FIXES = {
    "ssh_disable_root_login",
    "ssh_disable_x11_forwarding",
    "pam_enable_pwquality",
}

FIX_TARGET_FILES: dict[str, list[str]] = {
    "ssh_disable_root_login": ["/etc/ssh/sshd_config"],
    "ssh_disable_x11_forwarding": ["/etc/ssh/sshd_config"],
    "pam_enable_pwquality": ["/etc/security/pwquality.conf"],
    "ufw_enable_default_deny": ["/etc/ufw/ufw.conf"],
}


def _allow_auto_fix() -> bool:
    return os.environ.get("YAPSEC_ALLOW_AUTO_FIX", "").strip().lower() in ("1", "true", "yes")


async def _emit(hub: Any | None, payload: dict[str, Any]) -> None:
    if hub is None:
        return
    try:
        await hub.broadcast(payload)
    except Exception:
        # WebSocket emission should never break remediation flow.
        pass


def _script_for_fix(fix_id: str) -> str | None:
    cmds = auditor.FIX_SNIPPETS.get(fix_id)
    if not cmds:
        return None
    return "\n".join(cmds)


def preview_fix(fix_id: str) -> dict[str, Any]:
    script = _script_for_fix(fix_id)
    if not script:
        return {"ok": False, "error": f"unknown fix_id: {fix_id}"}
    return {
        "ok": True,
        "fix_id": fix_id,
        "risk": "low" if fix_id in LOW_RISK_FIXES else "high",
        "target_files": FIX_TARGET_FILES.get(fix_id, []),
        "script": script,
        "dry_run": True,
    }


def _snapshot_files(fix_id: str, target_files: list[str]) -> dict[str, Any]:
    sid = uuid.uuid4().hex[:12]
    snap_dir = SNAPSHOT_ROOT / sid
    snap_dir.mkdir(parents=True, exist_ok=True)
    copied: list[dict[str, Any]] = []
    for raw in target_files:
        src = Path(raw)
        if not src.exists():
            copied.append({"source": str(src), "exists": False})
            continue
        # Flatten path to avoid nesting complexity.
        safe_name = str(src).replace("/", "__").lstrip("_")
        dst = snap_dir / safe_name
        shutil.copy2(src, dst)
        copied.append({"source": str(src), "exists": True, "snapshot": str(dst)})
    manifest = {
        "snapshot_id": sid,
        "fix_id": fix_id,
        "created_at": auditor._now_stamp(),
        "files": copied,
    }
    (snap_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return manifest


def list_snapshots() -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for p in sorted(SNAPSHOT_ROOT.iterdir(), reverse=True):
        man = p / "manifest.json"
        if not man.exists():
            continue
        try:
            data = json.loads(man.read_text(encoding="utf-8"))
            rows.append(
                {
                    "snapshot_id": data.get("snapshot_id", p.name),
                    "fix_id": data.get("fix_id"),
                    "created_at": data.get("created_at"),
                    "file_count": len(data.get("files", [])),
                }
            )
        except Exception:
            continue
    return {"ok": True, "snapshots": rows[:40]}


async def apply_fix(fix_id: str, dry_run: bool = True, hub: Any | None = None) -> dict[str, Any]:
    preview = preview_fix(fix_id)
    if not preview.get("ok"):
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "critical",
                "message": f"Healer rejected unknown fix: {fix_id}",
                "timestamp": auditor._now_stamp(),
                "meta": {"fix_id": fix_id},
            },
        )
        return preview
    cmds = auditor.FIX_SNIPPETS.get(fix_id, [])
    target_files = FIX_TARGET_FILES.get(fix_id, [])
    if dry_run:
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "info",
                "message": f"Healer dry-run preview ready: {fix_id}",
                "timestamp": auditor._now_stamp(),
                "meta": {"fix_id": fix_id, "mode": "dry_run", "steps": len(cmds)},
            },
        )
        return {**preview, "commands": cmds}
    if not _allow_auto_fix():
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "warn",
                "message": f"Healer blocked (auto-fix disabled): {fix_id}",
                "timestamp": auditor._now_stamp(),
                "meta": {"fix_id": fix_id},
            },
        )
        return {"ok": False, "error": "auto-fix disabled", "hint": "export YAPSEC_ALLOW_AUTO_FIX=1", "preview": cmds}

    snapshot = _snapshot_files(fix_id, target_files)
    await _emit(
        hub,
        {
            "module": "network",
            "type": "healer",
            "severity": "warn",
            "message": f"Healer applying fix {fix_id} (snapshot {snapshot['snapshot_id']})",
            "timestamp": auditor._now_stamp(),
            "meta": {"fix_id": fix_id, "snapshot_id": snapshot["snapshot_id"], "total_steps": len(cmds)},
        },
    )
    steps: list[dict[str, Any]] = []
    total = len(cmds)
    for idx, cmd in enumerate(cmds, start=1):
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out_b, err_b = await proc.communicate()
        steps.append(
            {
                "step": idx,
                "of": total,
                "progress_pct": int((idx / max(1, total)) * 100),
                "command": cmd,
                "returncode": proc.returncode,
                "stdout_tail": (out_b or b"").decode(errors="replace")[-3000:],
                "stderr_tail": (err_b or b"").decode(errors="replace")[-3000:],
            }
        )
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "info" if proc.returncode == 0 else "critical",
                "message": f"Healer step {idx}/{total} {'ok' if proc.returncode == 0 else 'failed'} for {fix_id}",
                "timestamp": auditor._now_stamp(),
                "meta": {
                    "fix_id": fix_id,
                    "snapshot_id": snapshot["snapshot_id"],
                    "progress_pct": int((idx / max(1, total)) * 100),
                    "command": cmd,
                    "returncode": proc.returncode,
                },
            },
        )
        if proc.returncode != 0:
            await _emit(
                hub,
                {
                    "module": "network",
                    "type": "healer",
                    "severity": "critical",
                    "message": f"Healer fix failed: {fix_id} at step {idx}",
                    "timestamp": auditor._now_stamp(),
                    "meta": {"fix_id": fix_id, "snapshot_id": snapshot["snapshot_id"], "failed_step": idx},
                },
            )
            return {
                "ok": False,
                "fix_id": fix_id,
                "snapshot_id": snapshot["snapshot_id"],
                "steps": steps,
                "error": f"command failed at step {idx}",
            }
    await _emit(
        hub,
        {
            "module": "network",
            "type": "healer",
            "severity": "info",
            "message": f"Healer fix complete: {fix_id}",
            "timestamp": auditor._now_stamp(),
            "meta": {"fix_id": fix_id, "snapshot_id": snapshot["snapshot_id"]},
        },
    )
    return {"ok": True, "fix_id": fix_id, "snapshot_id": snapshot["snapshot_id"], "steps": steps}


async def rollback(snapshot_id: str, hub: Any | None = None) -> dict[str, Any]:
    snap_dir = SNAPSHOT_ROOT / snapshot_id
    manifest_path = snap_dir / "manifest.json"
    if not manifest_path.exists():
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "critical",
                "message": f"Healer rollback failed (snapshot missing): {snapshot_id}",
                "timestamp": auditor._now_stamp(),
                "meta": {"snapshot_id": snapshot_id},
            },
        )
        return {"ok": False, "error": f"snapshot not found: {snapshot_id}"}
    if not _allow_auto_fix():
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "warn",
                "message": "Healer rollback blocked (auto-fix disabled)",
                "timestamp": auditor._now_stamp(),
                "meta": {"snapshot_id": snapshot_id},
            },
        )
        return {"ok": False, "error": "auto-fix disabled", "hint": "export YAPSEC_ALLOW_AUTO_FIX=1"}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {"ok": False, "error": "invalid snapshot manifest"}
    restored: list[dict[str, Any]] = []
    for f in manifest.get("files", []):
        if not f.get("exists"):
            continue
        src = Path(str(f.get("snapshot", "")))
        dst = Path(str(f.get("source", "")))
        if not src.exists() or not dst.parent.exists():
            restored.append({"source": str(dst), "ok": False, "error": "missing source or parent"})
            continue
        shutil.copy2(src, dst)
        restored.append({"source": str(dst), "ok": True})
    await _emit(
        hub,
        {
            "module": "network",
            "type": "healer",
            "severity": "warn",
            "message": f"Healer rollback complete: {snapshot_id}",
            "timestamp": auditor._now_stamp(),
            "meta": {"snapshot_id": snapshot_id, "restored_count": len([r for r in restored if r.get('ok')])},
        },
    )
    return {"ok": True, "snapshot_id": snapshot_id, "restored": restored}


async def harden_system(dry_run: bool = True, quick: bool = True, hub: Any | None = None) -> dict[str, Any]:
    await _emit(
        hub,
        {
            "module": "network",
            "type": "healer",
            "severity": "warn",
            "message": f"Hardening pass started ({'dry-run' if dry_run else 'apply'}, {'quick' if quick else 'full'})",
            "timestamp": auditor._now_stamp(),
            "meta": {"dry_run": dry_run, "quick": quick},
        },
    )
    audit_result = await auditor.run_lynis_audit(quick=quick)
    checklist = auditor.get_hardening_checklist()
    findings = checklist.get("findings") or []
    fix_ids: list[str] = []
    for f in findings:
        if not isinstance(f, dict):
            continue
        fid = f.get("fix_id")
        if isinstance(fid, str) and fid in LOW_RISK_FIXES and fid not in fix_ids:
            fix_ids.append(fid)
    applied: list[dict[str, Any]] = []
    total = len(fix_ids)
    for idx, fid in enumerate(fix_ids, start=1):
        await _emit(
            hub,
            {
                "module": "network",
                "type": "healer",
                "severity": "info",
                "message": f"Hardening processing fix {idx}/{total}: {fid}",
                "timestamp": auditor._now_stamp(),
                "meta": {"fix_id": fid, "progress_pct": int((idx / max(1, total)) * 100) if total else 100},
            },
        )
        res = await apply_fix(fid, dry_run=dry_run, hub=hub)
        applied.append(
            {
                "fix_id": fid,
                "progress_pct": int((idx / max(1, total)) * 100) if total else 100,
                "result": res,
            }
        )
        if not res.get("ok") and not dry_run:
            await _emit(
                hub,
                {
                    "module": "network",
                    "type": "healer",
                    "severity": "critical",
                    "message": f"Hardening stopped due to failed fix: {fid}",
                    "timestamp": auditor._now_stamp(),
                    "meta": {"fix_id": fid},
                },
            )
            break
    post = auditor.get_hardening_checklist()
    await _emit(
        hub,
        {
            "module": "network",
            "type": "healer",
            "severity": "info",
            "message": f"Hardening pass complete (before {checklist.get('hardening_index')} -> after {post.get('hardening_index')})",
            "timestamp": auditor._now_stamp(),
            "meta": {
                "dry_run": dry_run,
                "quick": quick,
                "candidate_fix_count": len(fix_ids),
                "before_hardening_index": checklist.get("hardening_index"),
                "after_hardening_index": post.get("hardening_index"),
            },
        },
    )
    return {
        "ok": True,
        "dry_run": dry_run,
        "quick": quick,
        "audit": audit_result,
        "candidate_fix_count": len(fix_ids),
        "applied": applied,
        "before_hardening_index": checklist.get("hardening_index"),
        "after_hardening_index": post.get("hardening_index"),
        "post_checklist": post,
    }
