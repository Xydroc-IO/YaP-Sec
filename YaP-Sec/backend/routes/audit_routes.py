from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from modules import auditor, healer
from services.feed_hub import feed_hub, iso_now

router = APIRouter(prefix="/audit", tags=["audit"])


class LynisRunBody(BaseModel):
    quick: bool = True


class FixBody(BaseModel):
    fix_id: str = Field(..., description="Curated remediation ID")


class OpenScapBody(BaseModel):
    profile: str | None = None


class CheckovBody(BaseModel):
    path: str = "."


class SummaryBody(BaseModel):
    findings: list[dict] = Field(default_factory=list)


class HealerFixBody(BaseModel):
    fix_id: str = Field(..., description="Curated remediation ID")
    dry_run: bool = True


class HealerRollbackBody(BaseModel):
    snapshot_id: str


class HardenBody(BaseModel):
    dry_run: bool = True
    quick: bool = True


def _report_meta(path: Path) -> dict:
    exists = path.exists()
    return {
        "path": str(path),
        "exists": exists,
        "size": path.stat().st_size if exists else 0,
        "updated_at": path.stat().st_mtime if exists else None,
    }


@router.post("/lynis/run")
async def run_lynis(body: LynisRunBody) -> dict:
    return await auditor.run_lynis_audit(quick=body.quick)


@router.get("/lynis/checklist")
async def lynis_checklist() -> dict:
    return auditor.get_hardening_checklist()


@router.post("/fix")
async def apply_fix(body: FixBody) -> dict:
    result = await auditor.apply_fix(body.fix_id)
    if not result.get("ok") and result.get("error") == "auto-fix disabled":
        raise HTTPException(status_code=403, detail=result)
    if not result.get("ok") and "unknown fix_id" in str(result.get("error")):
        raise HTTPException(status_code=400, detail=result)
    return result


@router.get("/healer/snapshots")
async def healer_snapshots() -> dict:
    return healer.list_snapshots()


@router.post("/healer/preview")
async def healer_preview(body: FixBody) -> dict:
    result = healer.preview_fix(body.fix_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result)
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "healer",
            "severity": "info",
            "message": f"Healer preview generated: {body.fix_id}",
            "timestamp": iso_now(),
            "meta": {"fix_id": body.fix_id, "mode": "dry_run"},
        }
    )
    return result


@router.post("/healer/apply")
async def healer_apply(body: HealerFixBody) -> dict:
    result = await healer.apply_fix(body.fix_id, dry_run=body.dry_run, hub=feed_hub)
    if not result.get("ok") and result.get("error") == "auto-fix disabled":
        raise HTTPException(status_code=403, detail=result)
    if not result.get("ok") and "unknown fix_id" in str(result.get("error")):
        raise HTTPException(status_code=400, detail=result)
    return result


@router.post("/healer/rollback")
async def healer_rollback(body: HealerRollbackBody) -> dict:
    result = await healer.rollback(body.snapshot_id, hub=feed_hub)
    if not result.get("ok") and result.get("error") == "auto-fix disabled":
        raise HTTPException(status_code=403, detail=result)
    if not result.get("ok") and "snapshot not found" in str(result.get("error")):
        raise HTTPException(status_code=404, detail=result)
    return result


@router.post("/harden-system")
async def harden_system(body: HardenBody) -> dict:
    return await healer.harden_system(dry_run=body.dry_run, quick=body.quick, hub=feed_hub)


@router.get("/reports")
async def audit_reports() -> dict:
    return {
        "ok": True,
        "reports": {
            "openscap_html": _report_meta(auditor.OPENSCAP_HTML),
            "openscap_xml": _report_meta(auditor.OPENSCAP_XML),
            "checkov_json": _report_meta(auditor.CHECKOV_JSON),
            "lynis_log": _report_meta(auditor.LYNIS_LOG),
        },
    }


@router.get("/reports/openscap/html")
async def report_openscap_html() -> FileResponse:
    if not auditor.OPENSCAP_HTML.exists():
        raise HTTPException(status_code=404, detail="OpenSCAP HTML report not found. Run OpenSCAP first.")
    return FileResponse(path=str(auditor.OPENSCAP_HTML), media_type="text/html", filename=auditor.OPENSCAP_HTML.name)


@router.get("/reports/checkov/json")
async def report_checkov_json() -> dict:
    if not auditor.CHECKOV_JSON.exists():
        raise HTTPException(status_code=404, detail="Checkov JSON report not found. Run Checkov first.")
    text = auditor.CHECKOV_JSON.read_text(encoding="utf-8", errors="replace")
    try:
        return {"ok": True, "path": str(auditor.CHECKOV_JSON), "report": json.loads(text or "{}")}
    except json.JSONDecodeError:
        return {"ok": False, "path": str(auditor.CHECKOV_JSON), "error": "invalid json", "raw": text[-10000:]}


@router.get("/reports/lynis/log")
async def report_lynis_log(tail: int = 300) -> dict:
    if not auditor.LYNIS_LOG.exists():
        raise HTTPException(status_code=404, detail="Lynis log not found. Run Lynis first.")
    rows = auditor.LYNIS_LOG.read_text(errors="replace").splitlines()
    t = max(20, min(1500, tail))
    return {"ok": True, "path": str(auditor.LYNIS_LOG), "tail": rows[-t:]}


@router.post("/openscap/run")
async def run_openscap(body: OpenScapBody) -> dict:
    return await auditor.run_openscap(profile=body.profile)


@router.post("/checkov/run")
async def run_checkov(body: CheckovBody) -> dict:
    return await auditor.run_checkov(path=body.path)


@router.post("/executive-summary")
async def exec_summary(body: SummaryBody) -> dict:
    findings = []
    for idx, f in enumerate(body.findings):
        if not isinstance(f, dict):
            continue
        findings.append(
            auditor.AuditFinding(
                id=str(f.get("id") or f"ad-hoc-{idx}"),
                severity="warning" if str(f.get("severity", "")).lower() == "warning" else "suggestion",
                policy_name=str(f.get("policy_name") or "General Hardening"),
                description=str(f.get("description") or ""),
                raw=str(f.get("raw") or ""),
                fix_id=f.get("fix_id") if isinstance(f.get("fix_id"), str) else None,
                source=str(f.get("source") or "unknown"),
                passed=bool(f.get("passed", False)),
            )
        )
    bullets = await auditor.llm_executive_summary(findings)
    return {
        "ok": True,
        "hardening_index": auditor.hardening_index(findings),
        "bullets": bullets,
    }
