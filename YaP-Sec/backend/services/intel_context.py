from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class IntelContext:
    targets: deque[str] = field(default_factory=lambda: deque(maxlen=30))
    urls: deque[str] = field(default_factory=lambda: deque(maxlen=30))
    ifaces: deque[str] = field(default_factory=lambda: deque(maxlen=20))
    open_ports: deque[str] = field(default_factory=lambda: deque(maxlen=120))
    events: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=120))

    def _append_unique(self, q: deque[str], value: str) -> None:
        v = value.strip()
        if not v:
            return
        if v in q:
            q.remove(v)
        q.appendleft(v)

    def add_target(self, target: str, source: str) -> None:
        self._append_unique(self.targets, target)
        self.events.appendleft({"type": "target", "value": target, "source": source, "timestamp": iso_now()})

    def add_url(self, url: str, source: str) -> None:
        self._append_unique(self.urls, url)
        self.events.appendleft({"type": "url", "value": url, "source": source, "timestamp": iso_now()})

    def add_iface(self, iface: str, source: str) -> None:
        self._append_unique(self.ifaces, iface)
        self.events.appendleft({"type": "iface", "value": iface, "source": source, "timestamp": iso_now()})

    def add_open_ports(self, ports: list[str], source: str) -> None:
        for p in ports[:80]:
            self._append_unique(self.open_ports, p)
        if ports:
            self.events.appendleft(
                {
                    "type": "ports",
                    "value": f"{len(ports)} ports",
                    "source": source,
                    "timestamp": iso_now(),
                }
            )

    def snapshot(self) -> dict[str, Any]:
        suggested_urls: list[str] = []
        targets = list(self.targets)
        open_ports = list(self.open_ports)
        if targets:
            t = targets[0]
            if any("/tcp" in p and p.startswith("80/") for p in open_ports):
                suggested_urls.append(f"http://{t}")
            if any("/tcp" in p and p.startswith("443/") for p in open_ports):
                suggested_urls.append(f"https://{t}")
        return {
            "targets": list(self.targets),
            "urls": list(self.urls),
            "ifaces": list(self.ifaces),
            "open_ports": list(self.open_ports),
            "suggested_urls": suggested_urls,
            "events": list(self.events),
        }


intel_context = IntelContext()
