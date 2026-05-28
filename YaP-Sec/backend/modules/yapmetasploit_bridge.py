from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
from typing import Any

DEFAULT_CANDIDATES = ("yapmetasploit", "yapmetasploint")
_gui_proc: subprocess.Popen[str] | None = None


def _enabled() -> bool:
    return os.environ.get("YAPSEC_ENABLE_YAPMETASPLOIT_MODULE", "").strip().lower() in ("1", "true", "yes")


def _resolve_command() -> tuple[str, bool, list[str]]:
    raw = os.environ.get("YAPMETASPLOIT_CMD", "").strip()
    candidates = [raw] if raw else list(DEFAULT_CANDIDATES)
    for cand in candidates:
        if shutil.which(cand):
            return cand, True, candidates
    fallback = candidates[0] if candidates else DEFAULT_CANDIDATES[0]
    return fallback, False, candidates


def status() -> dict[str, Any]:
    cmd, ok, candidates = _resolve_command()
    return {
        "ok": True,
        "enabled": _enabled(),
        "command": cmd,
        "available": ok,
        "candidates": candidates,
    }


async def run(args: list[str], timeout_sec: int = 45) -> dict[str, Any]:
    st = status()
    if not st["enabled"]:
        return {
            "ok": False,
            "error": "module disabled",
            "hint": "export YAPSEC_ENABLE_YAPMETASPLOIT_MODULE=1",
        }
    cmd = st["command"]
    if not st["available"]:
        return {"ok": False, "error": f"command not found in PATH: {cmd}"}
    t = max(5, min(300, timeout_sec))
    full_cmd = [cmd, *args]
    try:
        proc = await asyncio.create_subprocess_exec(
            *full_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out_b, err_b = await asyncio.wait_for(proc.communicate(), timeout=t)
    except asyncio.TimeoutError:
        return {"ok": False, "timeout": True, "command": full_cmd, "error": f"timed out after {t}s"}
    return {
        "ok": proc.returncode == 0,
        "command": full_cmd,
        "returncode": proc.returncode,
        "stdout_tail": (out_b or b"").decode(errors="replace")[-10000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-6000:],
    }


def _gui_entry() -> str:
    # Expected local clone path for YaP-Metasploit-GUI project.
    return os.environ.get("YAPMETASPLOIT_GUI_ENTRY", "").strip() or os.path.expanduser(
        "~/YaP-Metasploit-GUI/core/metasploit_gui.py"
    )


def gui_status() -> dict[str, Any]:
    running = _gui_proc is not None and _gui_proc.poll() is None
    entry = _gui_entry()
    return {
        "ok": True,
        "entry": entry,
        "entry_exists": os.path.exists(entry),
        "running": running,
        "pid": _gui_proc.pid if running and _gui_proc else None,
    }


def start_gui() -> dict[str, Any]:
    global _gui_proc
    st = gui_status()
    if st["running"]:
        return {"ok": True, "already_running": True, **st}
    if not st["entry_exists"]:
        return {"ok": False, "error": "gui entry not found", "entry": st["entry"]}
    log_path = "/tmp/yapsec-yapmetasploit-gui.log"
    log = open(log_path, "a", encoding="utf-8")
    try:
        _gui_proc = subprocess.Popen(
            ["python3", st["entry"]],
            stdout=log,
            stderr=log,
            text=True,
            start_new_session=True,
        )
    except Exception as e:
        log.close()
        return {"ok": False, "error": str(e), "entry": st["entry"]}
    return {
        "ok": True,
        "running": True,
        "pid": _gui_proc.pid if _gui_proc else None,
        "entry": st["entry"],
        "log_path": log_path,
    }


def stop_gui() -> dict[str, Any]:
    global _gui_proc
    if _gui_proc is None or _gui_proc.poll() is not None:
        _gui_proc = None
        return {"ok": True, "running": False, "stopped": False}
    try:
        _gui_proc.terminate()
    except Exception as e:
        return {"ok": False, "error": str(e)}
    _gui_proc = None
    return {"ok": True, "running": False, "stopped": True}
