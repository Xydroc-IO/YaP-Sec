from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from modules import metasploit_bridge as msf

router = APIRouter(prefix="/msf", tags=["metasploit"])


class MsfConnectBody(BaseModel):
    password: str
    host: str = "127.0.0.1"
    port: int = 55553
    ssl: bool = False


class HandlerBody(BaseModel):
    lhost: str
    lport: int = Field(..., ge=1, le=65535)
    payload: str = "linux/x64/meterpreter/reverse_tcp"


class ModuleRunBody(BaseModel):
    modtype: str = Field(..., description="exploit | auxiliary")
    module: str
    options: dict[str, str] = Field(default_factory=dict)


class MsfDaemonBody(BaseModel):
    password: str
    host: str = "127.0.0.1"
    port: int = 55553
    ssl: bool = False


class MsfCredentialGenerateBody(BaseModel):
    host: str = "127.0.0.1"
    port: int = 55553
    ssl: bool = False


@router.get("/status")
async def msf_status() -> dict:
    return {"connected": msf.connected(), "daemon": msf.daemon_status()}


@router.get("/credentials")
async def msf_credentials() -> dict:
    # Never expose saved password in this endpoint.
    return msf.get_saved_credentials(include_password=False)


@router.post("/credentials/generate")
async def msf_credentials_generate(body: MsfCredentialGenerateBody) -> dict:
    return msf.generate_and_save_credentials(host=body.host, port=body.port, ssl=body.ssl)


@router.post("/daemon/start")
async def msf_daemon_start(body: MsfDaemonBody) -> dict:
    try:
        cfg = msf.MsfDaemonConfig(
            password=body.password,
            host=body.host,
            port=body.port,
            ssl=body.ssl,
        )
        return msf.start_daemon(cfg)
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/daemon/stop")
async def msf_daemon_stop() -> dict:
    try:
        return msf.stop_daemon()
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/connect")
async def msf_connect(body: MsfConnectBody) -> dict:
    try:
        cfg = msf.MsfConfig(
            host=body.host,
            port=body.port,
            password=body.password,
            ssl=body.ssl,
        )
        return msf.connect(cfg)
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=501, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/exploits")
async def msf_exploits(limit: int = 60, q: str | None = None) -> dict:
    try:
        if q and q.strip():
            return msf.search_exploits(q, limit=limit)
        return msf.list_exploits(limit=limit)
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/handler")
async def msf_handler(body: HandlerBody) -> dict:
    try:
        return msf.start_reverse_handler(body.lhost, body.lport, body.payload)
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/module/run")
async def msf_run_module(body: ModuleRunBody) -> dict:
    try:
        return msf.run_module(body.modtype, body.module, body.options)
    except msf.MsfBridgeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
