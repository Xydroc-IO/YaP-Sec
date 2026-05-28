from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from modules import sqlmap_bridge
from services.feed_hub import feed_hub, iso_now
from services.intel_context import intel_context

router = APIRouter(prefix="/sqlmap", tags=["sqlmap"])


class SqlmapBody(BaseModel):
    url: str = Field(..., examples=["https://target.local/item.php?id=1"])
    risk: int = Field(default=1, ge=1, le=3)
    level: int = Field(default=1, ge=1, le=5)
    extra_args: list[str] = Field(default_factory=list)


@router.get("/status")
async def status() -> dict:
    return {"ok": True, "available": sqlmap_bridge.sqlmap_available()}


@router.post("/scan")
async def scan(body: SqlmapBody) -> dict:
    result = await sqlmap_bridge.run_scan(body.url, body.risk, body.level, body.extra_args)
    intel_context.add_url(body.url, "sqlmap")
    sev = "critical" if result.get("findings") else ("warn" if result.get("ok") else "critical")
    await feed_hub.broadcast(
        {
            "module": "web",
            "type": "threat" if result.get("findings") else "scan",
            "severity": sev,
            "message": f"SQLMap scan {'found issues' if result.get('findings') else 'completed'}: {body.url}",
            "timestamp": iso_now(),
            "meta": {"sqlmap": result},
        }
    )
    return result
