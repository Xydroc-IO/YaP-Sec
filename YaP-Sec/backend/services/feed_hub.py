"""Shared WebSocket broadcast hub (decoupled from route modules)."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Hub:
    clients: set[Any] = field(default_factory=set)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def connect(self, ws: Any) -> None:
        await ws.accept()
        async with self.lock:
            self.clients.add(ws)

    async def disconnect(self, ws: Any) -> None:
        async with self.lock:
            self.clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload)
        async with self.lock:
            dead: list[Any] = []
            for c in self.clients:
                try:
                    await c.send_text(raw)
                except Exception:
                    dead.append(c)
            for c in dead:
                self.clients.discard(c)


feed_hub = Hub()
