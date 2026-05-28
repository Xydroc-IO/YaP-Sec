from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.intel_context import intel_context

router = APIRouter(prefix="/intel", tags=["intel"])


class IntelPushBody(BaseModel):
    kind: str = Field(..., description="target | url | iface")
    value: str
    source: str = "manual"


@router.get("/context")
async def get_context() -> dict:
    return {"ok": True, "context": intel_context.snapshot()}


@router.post("/push")
async def push_context(body: IntelPushBody) -> dict:
    kind = body.kind.strip().lower()
    if kind == "target":
        intel_context.add_target(body.value, body.source)
    elif kind == "url":
        intel_context.add_url(body.value, body.source)
    elif kind == "iface":
        intel_context.add_iface(body.value, body.source)
    else:
        return {"ok": False, "error": "invalid kind"}
    return {"ok": True, "context": intel_context.snapshot()}
