from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from modules import deps_manager

router = APIRouter(prefix="/tools", tags=["tools"])


class InstallRequest(BaseModel):
    tool_id: str = Field(..., description="Any configured tool id from /api/tools/status")


@router.get("/status")
async def tools_status() -> dict:
    return deps_manager.tools_snapshot()


@router.post("/install")
async def tools_install(body: InstallRequest) -> dict:
    result = await deps_manager.install_tool(body.tool_id)
    if not result.get("ok") and result.get("error") == "install disabled":
        raise HTTPException(status_code=403, detail=result)
    if not result.get("ok") and "unknown tool" in (result.get("error") or ""):
        raise HTTPException(status_code=400, detail=result)
    return result


@router.post("/install-stack")
async def tools_install_stack() -> dict:
    result = await deps_manager.install_security_stack()
    if not result.get("ok") and not deps_manager.allow_sudo_install():
        raise HTTPException(status_code=403, detail=result)
    return result
