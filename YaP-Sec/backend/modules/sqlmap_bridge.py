from __future__ import annotations

import asyncio
import shutil
from typing import Any


def sqlmap_available() -> bool:
    return shutil.which("sqlmap") is not None


async def run_scan(
    url: str,
    risk: int = 1,
    level: int = 1,
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    if not sqlmap_available():
        return {"ok": False, "error": "sqlmap not found in PATH"}
    cmd = [
        shutil.which("sqlmap") or "sqlmap",
        "-u",
        url,
        "--batch",
        "--risk",
        str(max(1, min(3, risk))),
        "--level",
        str(max(1, min(5, level))),
    ]
    if extra_args:
        cmd.extend(extra_args)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    text = (out_b or b"").decode(errors="replace")
    findings = [ln.strip() for ln in text.splitlines() if "is vulnerable" in ln.lower() or "parameter" in ln.lower()]
    return {
        "ok": proc.returncode == 0,
        "url": url,
        "risk": risk,
        "level": level,
        "returncode": proc.returncode,
        "findings": findings[:100],
        "command": cmd,
        "stdout_tail": text[-10000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-5000:],
    }
