from __future__ import annotations

import asyncio
import re
import shutil
from typing import Any


def _bin(name: str) -> str | None:
    return shutil.which(name)


def suite_status() -> dict[str, Any]:
    bins = {
        "aircrack-ng": _bin("aircrack-ng"),
        "airmon-ng": _bin("airmon-ng"),
        "airodump-ng": _bin("airodump-ng"),
        "aireplay-ng": _bin("aireplay-ng"),
    }
    return {"ok": True, "available": all(bool(v) for v in bins.values()), "binaries": bins}


async def list_interfaces() -> dict[str, Any]:
    # Prefer `iw dev` output parsing.
    proc = await asyncio.create_subprocess_exec(
        "iw",
        "dev",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    text = (out_b or b"").decode(errors="replace")
    if proc.returncode != 0:
        return {"ok": False, "error": (err_b or b"").decode(errors="replace")[-3000:]}
    ifaces = re.findall(r"Interface\s+([a-zA-Z0-9_.-]+)", text)
    return {"ok": True, "interfaces": sorted(set(ifaces))}


async def passive_scan(iface: str, seconds: int = 8, extra_args: list[str] | None = None) -> dict[str, Any]:
    """
    Passive survey only. This does not perform deauth/injection/cracking.
    """
    airodump = _bin("airodump-ng")
    if not airodump:
        return {"ok": False, "error": "airodump-ng not found in PATH"}
    t = max(3, min(20, seconds))
    cmd = ["timeout", str(t), airodump]
    if extra_args:
        cmd.extend(extra_args)
    cmd.append(iface)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    out = (out_b or b"").decode(errors="replace")
    err = (err_b or b"").decode(errors="replace")
    return {
        "ok": proc.returncode in (0, 124),  # timeout exits 124 by design
        "returncode": proc.returncode,
        "iface": iface,
        "seconds": t,
        "command": cmd,
        "stdout_tail": out[-10000:],
        "stderr_tail": err[-4000:],
        "note": "Passive capture only. For authorized lab use.",
    }


async def monitor_mode(action: str, iface: str) -> dict[str, Any]:
    airmon = _bin("airmon-ng")
    if not airmon:
        return {"ok": False, "error": "airmon-ng not found in PATH"}
    cmd = [airmon, action, iface]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    return {
        "ok": proc.returncode == 0,
        "action": action,
        "iface": iface,
        "returncode": proc.returncode,
        "command": cmd,
        "stdout_tail": (out_b or b"").decode(errors="replace")[-4000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-3000:],
    }
