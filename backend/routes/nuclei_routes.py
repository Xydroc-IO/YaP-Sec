from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from modules import nuclei_scanner
from services.feed_hub import feed_hub
from services.intel_context import intel_context

router = APIRouter(prefix="/nuclei", tags=["nuclei"])


class NucleiRunBody(BaseModel):
    target: str
    severities: list[str] = Field(default_factory=lambda: ["critical", "high"])
    extra_args: list[str] = Field(default_factory=list)


@router.get("/stream")
async def nuclei_stream(target: str, severities: str | None = None, extra_args: str | None = None) -> StreamingResponse:
    if not target.strip():
        raise HTTPException(status_code=400, detail="target query param required")
    intel_context.add_url(target.strip(), "nuclei")
    sev_list = [s.strip() for s in (severities or "").split(",") if s.strip()] if severities else None
    arg_list = [a for a in (extra_args or "").split(" ") if a.strip()] if extra_args else None

    async def gen():
        async for chunk in nuclei_scanner.stream_scan(target.strip(), hub=feed_hub, severities=sev_list, extra_args=arg_list):
            yield chunk

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/run")
async def nuclei_run(body: NucleiRunBody) -> dict:
    if not body.target.strip():
        raise HTTPException(status_code=400, detail="target is required")
    intel_context.add_url(body.target.strip(), "nuclei")
    last: dict = {}
    async for chunk in nuclei_scanner.stream_scan(
        body.target.strip(),
        hub=feed_hub,
        severities=body.severities,
        extra_args=body.extra_args,
    ):
        text = chunk.decode(errors="replace").strip()
        if not text:
            continue
        try:
            import json

            last = json.loads(text)
        except Exception:
            pass
    return {"ok": True, "target": body.target, "last": last}
