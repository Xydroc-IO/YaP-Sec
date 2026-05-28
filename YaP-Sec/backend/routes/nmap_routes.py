from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from modules import nmap_bridge
from services.feed_hub import feed_hub, iso_now
from services.intel_context import intel_context

router = APIRouter(prefix="/nmap", tags=["nmap"])


class NmapBody(BaseModel):
    target: str = Field(..., examples=["192.168.1.10"])
    profile: str = Field(default="quick", examples=["quick", "full_tcp", "service"])
    extra_args: list[str] = Field(default_factory=list)


@router.get("/status")
async def status() -> dict:
    return {"ok": True, "available": nmap_bridge.nmap_available()}


@router.post("/scan")
async def scan(body: NmapBody) -> dict:
    result = await nmap_bridge.run_scan(body.target, body.profile, body.extra_args)
    intel_context.add_target(body.target, "nmap")
    intel_context.add_open_ports(result.get("open_ports") or [], "nmap")
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "scan",
            "severity": "warn" if result.get("ok") else "critical",
            "message": f"Nmap {body.profile} scan {'done' if result.get('ok') else 'failed'}: {body.target}",
            "timestamp": iso_now(),
            "meta": {"nmap": result},
        }
    )
    return result
