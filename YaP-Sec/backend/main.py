from __future__ import annotations

import asyncio
import json
import os
import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from routes import (
    aircrack_routes,
    audit_routes,
    intel_routes,
    msf_routes,
    nmap_routes,
    nuclei_routes,
    orchestrator_routes,
    sqlmap_routes,
    tools_routes,
    yapmetasploit_routes,
)
from services.feed_hub import feed_hub, iso_now
from services.intel_context import intel_context


SAMPLE_MESSAGES: list[dict[str, Any]] = [
    {
        "module": "network",
        "type": "log",
        "severity": "info",
        "message": "tap0: 12k pps inbound · TLS 1.3 handshakes stable",
    },
    {
        "module": "network",
        "type": "status",
        "severity": "info",
        "message": "flow hash rebalanced · egress spike +4%",
    },
    {
        "module": "web",
        "type": "log",
        "severity": "warn",
        "message": "crawler: /admin returned 302 → /login?next=%2Fadmin",
    },
    {
        "module": "web",
        "type": "threat",
        "severity": "critical",
        "message": "Confirmed SQLi on /api/user?id= — time-based blind",
        "meta": {"payload": "1' AND SLEEP(5)-- -"},
    },
    {
        "module": "social",
        "type": "log",
        "severity": "info",
        "message": "campaign 'Q1-audit' · 42 sends · 6 clicks (sandbox)",
    },
    {
        "module": "social",
        "type": "threat",
        "severity": "warn",
        "message": "template drift: reply-to domain mismatch corporate MX",
    },
]


async def synth_loop() -> None:
    i = 0
    while True:
        await asyncio.sleep(random.uniform(0.9, 2.2))
        base = dict(SAMPLE_MESSAGES[i % len(SAMPLE_MESSAGES)])
        base["timestamp"] = iso_now()
        if base.get("type") == "log":
            base["message"] = f"{base['message']} · seq={i}"
        await feed_hub.broadcast(base)
        i += 1


broadcast_task: asyncio.Task[None] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global broadcast_task
    broadcast_task = asyncio.create_task(synth_loop())
    yield
    if broadcast_task:
        broadcast_task.cancel()
        try:
            await broadcast_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="YaPsec API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools_routes.router, prefix="/api")
app.include_router(msf_routes.router, prefix="/api")
app.include_router(nuclei_routes.router, prefix="/api")
app.include_router(nmap_routes.router, prefix="/api")
app.include_router(sqlmap_routes.router, prefix="/api")
app.include_router(aircrack_routes.router, prefix="/api")
app.include_router(intel_routes.router, prefix="/api")
app.include_router(audit_routes.router, prefix="/api")
app.include_router(orchestrator_routes.router, prefix="/api")
app.include_router(yapmetasploit_routes.router, prefix="/api")

from routes import halt_routes
app.include_router(halt_routes.router, prefix="/api")


def _loopback(host: str | None) -> bool:
    if not host:
        return False
    h = host.strip().lower()
    return h in {"127.0.0.1", "::1", "localhost"}


@app.middleware("http")
async def api_guard(request: Request, call_next):
    """
    Security hardening:
    - Localhost traffic is allowed by default for smoother desktop usage.
    - Non-local callers must provide X-API-Key when YAPSEC_API_KEY is set.
    """
    path = request.url.path
    if path.startswith("/api/") or path == "/trigger-scan":
        client_host = request.client.host if request.client else None
        api_key = os.environ.get("YAPSEC_API_KEY", "").strip()
        if not _loopback(client_host):
            if not api_key:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "remote API disabled: set YAPSEC_API_KEY for network access"},
                )
            provided = request.headers.get("x-api-key", "").strip()
            if provided != api_key:
                return JSONResponse(status_code=401, content={"detail": "invalid API key"})
    return await call_next(request)


class ScanRequest(BaseModel):
    target_ip: str = Field(..., examples=["192.168.1.10"])
    scan_type: str = Field(..., examples=["quick", "full_tcp", "web_crawl", "social_recon"])


@app.websocket("/ws/feed")
async def ws_feed(ws: WebSocket) -> None:
    client_host = ws.client.host if ws.client else None
    api_key = os.environ.get("YAPSEC_API_KEY", "").strip()
    if not _loopback(client_host):
        if not api_key:
            await ws.close(code=1008)
            return
        if ws.headers.get("x-api-key", "").strip() != api_key:
            await ws.close(code=1008)
            return
    await feed_hub.connect(ws)
    try:
        await ws.send_text(
            json.dumps(
                {
                    "module": "network",
                    "type": "status",
                    "severity": "info",
                    "message": "WebSocket subscribed — YaPsec feed",
                    "timestamp": iso_now(),
                }
            )
        )
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        # Clients can disconnect mid-handshake/send; treat as normal teardown.
        pass
    finally:
        await feed_hub.disconnect(ws)


@app.post("/trigger-scan")
async def trigger_scan(body: ScanRequest) -> dict[str, Any]:
    intel_context.add_target(body.target_ip, "trigger-scan")
    payload = {
        "module": "web",
        "type": "scan",
        "severity": "warn",
        "message": f"Scan queued: {body.scan_type} → {body.target_ip}",
        "timestamp": iso_now(),
        "meta": {"target_ip": body.target_ip, "scan_type": body.scan_type},
    }
    await feed_hub.broadcast(payload)
    return {"ok": True, "accepted": body.model_dump(), "broadcast": True}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
