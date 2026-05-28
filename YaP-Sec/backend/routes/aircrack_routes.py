from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from modules import aircrack_bridge
from services.feed_hub import feed_hub, iso_now
from services.intel_context import intel_context

router = APIRouter(prefix="/aircrack", tags=["aircrack"])


class AirPassiveBody(BaseModel):
    iface: str = Field(..., examples=["wlan0mon", "wlan0"])
    seconds: int = Field(default=8, ge=3, le=20)
    extra_args: list[str] = Field(default_factory=list)


class AirMonitorBody(BaseModel):
    iface: str = Field(..., examples=["wlan0"])
    action: str = Field(..., examples=["start", "stop"])


@router.get("/status")
async def status() -> dict:
    return aircrack_bridge.suite_status()


@router.get("/interfaces")
async def interfaces() -> dict:
    return await aircrack_bridge.list_interfaces()


@router.post("/passive-scan")
async def passive_scan(body: AirPassiveBody) -> dict:
    result = await aircrack_bridge.passive_scan(body.iface, body.seconds, body.extra_args)
    intel_context.add_iface(body.iface, "aircrack")
    await feed_hub.broadcast(
        {
            "module": "network",
            "type": "scan",
            "severity": "warn" if result.get("ok") else "critical",
            "message": f"Aircrack passive scan {'done' if result.get('ok') else 'failed'}: {body.iface}",
            "timestamp": iso_now(),
            "meta": {"aircrack": result},
        }
    )
    return result


@router.post("/monitor")
async def monitor_mode(body: AirMonitorBody) -> dict:
    return await aircrack_bridge.monitor_mode(body.action, body.iface)
