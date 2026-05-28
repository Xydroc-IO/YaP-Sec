from __future__ import annotations

import asyncio
import shutil
from typing import Any


def nmap_available() -> bool:
    return shutil.which("nmap") is not None


def build_args(target: str, profile: str) -> list[str]:
    base = [shutil.which("nmap") or "nmap"]
    p = profile.strip().lower()
    if p == "quick":
        return [*base, "-T4", "-F", target]
    if p == "full_tcp":
        return [*base, "-sS", "-p-", "-T3", target]
    if p == "service":
        return [*base, "-sV", "-O", target]
    return [*base, "-T4", "-F", target]


async def run_scan(target: str, profile: str = "quick", extra_args: list[str] | None = None) -> dict[str, Any]:
    if not nmap_available():
        return {"ok": False, "error": "nmap not found in PATH"}
    cmd = build_args(target, profile)
    if extra_args:
        cmd = [*cmd[:-1], *extra_args, cmd[-1]]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    text = (out_b or b"").decode(errors="replace")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    open_ports = [ln for ln in lines if "/tcp" in ln and "open" in ln]
    return {
        "ok": proc.returncode == 0,
        "target": target,
        "profile": profile,
        "returncode": proc.returncode,
        "open_ports": open_ports[:80],
        "command": cmd,
        "stdout_tail": text[-8000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-4000:],
    }
