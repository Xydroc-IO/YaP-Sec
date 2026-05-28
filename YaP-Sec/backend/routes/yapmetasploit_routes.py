from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from modules import yapmetasploit_bridge as ymsf
from services.feed_hub import feed_hub, iso_now
from services.intel_context import intel_context

router = APIRouter(prefix="/yapmetasploit", tags=["yapmetasploit"])


class YaPMsfRunBody(BaseModel):
    args: list[str] = Field(default_factory=list, description="CLI args to pass to yapmetasploit command")
    timeout_sec: int = Field(default=45, ge=5, le=300)


@router.get("/status")
async def module_status() -> dict:
    return ymsf.status()


@router.post("/run")
async def module_run(body: YaPMsfRunBody) -> dict:
    for i, tok in enumerate(body.args):
        if tok in {"--target", "-t"} and i + 1 < len(body.args):
            intel_context.add_target(body.args[i + 1], "yapmetasploit")
    result = await ymsf.run(body.args, timeout_sec=body.timeout_sec)
    sev = "warn" if result.get("ok") else "critical"
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "scan",
            "severity": sev,
            "message": f"YaPMetasploit module {'completed' if result.get('ok') else 'failed'}",
            "timestamp": iso_now(),
            "meta": {"yapmetasploit": result},
        }
    )
    if not result.get("ok") and result.get("error") == "module disabled":
        raise HTTPException(status_code=403, detail=result)
    if not result.get("ok") and "not found" in str(result.get("error")):
        raise HTTPException(status_code=404, detail=result)
    return result


@router.get("/gui/status")
async def gui_status() -> dict:
    return ymsf.gui_status()


@router.post("/gui/start")
async def gui_start() -> dict:
    result = ymsf.start_gui()
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "status",
            "severity": "warn" if result.get("ok") else "critical",
            "message": f"YaPMetasploit GUI {'started' if result.get('ok') else 'failed to start'}",
            "timestamp": iso_now(),
            "meta": {"yapmetasploit_gui": result},
        }
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result)
    return result


@router.post("/gui/stop")
async def gui_stop() -> dict:
    result = ymsf.stop_gui()
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "status",
            "severity": "warn" if result.get("ok") else "critical",
            "message": "YaPMetasploit GUI stop requested",
            "timestamp": iso_now(),
            "meta": {"yapmetasploit_gui": result},
        }
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result)
    return result
