from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from modules import auditor, deps_manager, metasploit_bridge as msf

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


class QuickStartBody(BaseModel):
    mode: str = Field(default="offensive", description="offensive | audit | full")
    msf_password: str | None = None
    msf_host: str = "127.0.0.1"
    msf_port: int = 55553
    msf_ssl: bool = False
    auto_install: bool = True
    auto_start_msf: bool = True
    auto_connect_msf: bool = True
    run_lynis_quick: bool = False


@router.get("/status")
async def orchestrator_status() -> dict:
    snap = deps_manager.tools_snapshot()
    ready = [t["id"] for t in snap.get("tools", []) if t.get("status") == "ready"]
    missing = [t["id"] for t in snap.get("tools", []) if t.get("status") != "ready"]
    return {
        "ok": True,
        "ready_count": len(ready),
        "missing_count": len(missing),
        "ready": ready,
        "missing": missing,
        "install_enabled": snap.get("install_enabled", False),
    }


@router.post("/quick-start")
async def orchestrator_quick_start(body: QuickStartBody) -> dict:
    """
    One-call helper for GUI onboarding:
    - checks stack
    - optionally attempts install (when env allows)
    """
    snap = deps_manager.tools_snapshot()
    need_install = [t for t in snap.get("tools", []) if t.get("status") != "ready"]
    install_result = None
    if body.auto_install and need_install and deps_manager.allow_sudo_install():
        install_result = await deps_manager.install_security_stack()
        snap = deps_manager.tools_snapshot()
    msf_result: dict | None = None
    msf_connect_result: dict | None = None
    audit_result: dict | None = None

    if body.auto_start_msf and body.msf_password:
        try:
            msf_cfg = msf.MsfDaemonConfig(
                password=body.msf_password,
                host=body.msf_host,
                port=body.msf_port,
                ssl=body.msf_ssl,
            )
            msf_result = msf.start_daemon(msf_cfg)
        except Exception as e:
            msf_result = {"ok": False, "error": str(e)}

    if body.auto_connect_msf and body.msf_password:
        try:
            cfg = msf.MsfConfig(
                host=body.msf_host,
                port=body.msf_port,
                password=body.msf_password,
                ssl=body.msf_ssl,
            )
            msf_connect_result = msf.connect(cfg)
        except Exception as e:
            msf_connect_result = {"ok": False, "error": str(e)}

    if body.run_lynis_quick:
        try:
            audit_result = await auditor.run_lynis_audit(quick=True)
        except Exception as e:
            audit_result = {"ok": False, "error": str(e)}

    ready_tools = [t["id"] for t in snap.get("tools", []) if t.get("status") == "ready"]
    missing_tools = [t["id"] for t in snap.get("tools", []) if t.get("status") != "ready"]
    return {
        "ok": True,
        "mode": body.mode,
        "initial_missing": [t["id"] for t in need_install],
        "install_attempted": bool(install_result),
        "install_result": install_result,
        "msf_daemon": msf_result,
        "msf_connect": msf_connect_result,
        "audit_quick": audit_result,
        "automation_summary": {
            "ready_tools": ready_tools,
            "missing_tools": missing_tools,
            "msf_connected": msf.connected(),
            "msf_daemon_running": msf.daemon_status().get("running", False),
        },
        "post_status": snap,
        "notes": [
            "Use only on systems/networks you own or are explicitly authorized to test.",
            "Aircrack integration in UI is passive survey by default.",
        ],
    }
