"""
Nuclei wrapper: JSON lines, filter Critical/High severities for streaming to the UI.
"""

from __future__ import annotations

import asyncio
import json
import shutil
from typing import Any, AsyncIterator


def nuclei_path() -> str | None:
    return shutil.which("nuclei")


def severity_ok(obj: dict[str, Any]) -> bool:
    sev = str(obj.get("info", {}).get("severity") or obj.get("severity") or "").lower()
    return sev in ("critical", "high")


async def stream_scan(
    target: str,
    hub: Any | None = None,
    severities: list[str] | None = None,
    extra_args: list[str] | None = None,
) -> AsyncIterator[bytes]:
    """
    Yields NDJSON lines (each ending in \\n) for findings that are Critical or High.
    If hub is provided, also broadcasts each finding to WebSocket clients.
    """
    exe = nuclei_path()
    if not exe:
        err = {"ok": False, "error": "nuclei not found in PATH", "target": target}
        line = json.dumps(err) + "\n"
        yield line.encode()
        return

    sev = ",".join(severities) if severities else "critical,high"
    cmd = [
        exe,
        "-u",
        target,
        "-json",
        "-severity",
        sev,
        "-silent",
    ]
    if extra_args:
        cmd.extend(extra_args)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    assert proc.stdout is not None
    while True:
        raw = await proc.stdout.readline()
        if not raw:
            break
        try:
            obj = json.loads(raw.decode(errors="replace"))
        except json.JSONDecodeError:
            continue
        if not severity_ok(obj):
            continue
        if hub is not None:
            msg = obj.get("template-id") or obj.get("template_id") or "nuclei"
            sev = (obj.get("info") or {}).get("severity") or obj.get("severity")
            await hub.broadcast(
                {
                    "module": "web",
                    "type": "threat",
                    "severity": "critical" if str(sev).lower() == "critical" else "warn",
                    "message": f"Nuclei [{sev}] {msg} — {target}",
                    "meta": {"nuclei": obj, "target": target},
                }
            )
        yield raw if raw.endswith(b"\n") else raw + b"\n"

    rc = await proc.wait()
    tail = b""
    if proc.stderr is not None:
        tail = await proc.stderr.read()
    done = {
        "ok": True,
        "done": True,
        "returncode": rc,
        "target": target,
        "command": cmd,
        "stderr_tail": tail.decode(errors="replace")[-2000:],
    }
    line = json.dumps(done) + "\n"
    yield line.encode()
