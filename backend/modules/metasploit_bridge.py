"""
Metasploit RPC bridge (msfrpcd). Isolated so import/RPC failures do not break the API.
"""

from __future__ import annotations

import os
import secrets
import shutil
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_client: Any = None
_msfrpcd_proc: subprocess.Popen[str] | None = None
_CREDS_PATH = Path("/tmp/yapsec-msf-credentials.json")


class MsfBridgeError(Exception):
    pass


def _get_client_class():
    try:
        from pymetasploit3.msfrpc import MsfRpcClient

        return MsfRpcClient
    except ImportError as e:
        raise MsfBridgeError("pymetasploit3 is not installed") from e


@dataclass
class MsfConfig:
    host: str = "127.0.0.1"
    port: int = 55553
    password: str = ""
    ssl: bool = False


@dataclass
class MsfDaemonConfig:
    password: str
    host: str = "127.0.0.1"
    port: int = 55553
    ssl: bool = False


def _read_creds() -> dict[str, Any] | None:
    if not _CREDS_PATH.exists():
        return None
    try:
        import json

        data = json.loads(_CREDS_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


def _write_creds(data: dict[str, Any]) -> None:
    import json

    _CREDS_PATH.write_text(json.dumps(data), encoding="utf-8")


def get_saved_credentials(include_password: bool = False) -> dict[str, Any]:
    saved = _read_creds()
    if not saved:
        return {
            "ok": True,
            "exists": False,
            "host": "127.0.0.1",
            "port": 55553,
            "ssl": False,
            "password": "" if include_password else None,
            "path": str(_CREDS_PATH),
        }
    out = {
        "ok": True,
        "exists": True,
        "host": saved.get("host", "127.0.0.1"),
        "port": int(saved.get("port", 55553)),
        "ssl": bool(saved.get("ssl", False)),
        "password": None,
        "path": str(_CREDS_PATH),
    }
    if include_password:
        out["password"] = str(saved.get("password", ""))
    return out


def generate_and_save_credentials(host: str = "127.0.0.1", port: int = 55553, ssl: bool = False) -> dict[str, Any]:
    pwd = secrets.token_urlsafe(18)
    data = {"host": host, "port": port, "ssl": ssl, "password": pwd}
    _write_creds(data)
    return {"ok": True, "generated": True, **data, "path": str(_CREDS_PATH)}


def connect(cfg: MsfConfig) -> dict[str, Any]:
    global _client
    Cls = _get_client_class()
    _client = Cls(cfg.password, port=cfg.port, server=cfg.host, ssl=cfg.ssl)
    return {"ok": True, "host": cfg.host, "port": cfg.port, "ssl": cfg.ssl}


def msfrpcd_available() -> bool:
    return shutil.which("msfrpcd") is not None


def daemon_status() -> dict[str, Any]:
    running = _msfrpcd_proc is not None and _msfrpcd_proc.poll() is None
    return {
        "running": running,
        "pid": _msfrpcd_proc.pid if running and _msfrpcd_proc else None,
        "available": msfrpcd_available(),
    }


def start_daemon(cfg: MsfDaemonConfig) -> dict[str, Any]:
    global _msfrpcd_proc
    st = daemon_status()
    if st["running"]:
        return {"ok": True, "already_running": True, **st}
    exe = shutil.which("msfrpcd")
    if not exe:
        raise MsfBridgeError("msfrpcd not found in PATH")

    args = [
        exe,
        "-a",
        cfg.host,
        "-p",
        str(cfg.port),
        "-P",
        cfg.password,
        "-f",
    ]
    if not cfg.ssl:
        args.append("-S")

    log_path = os.path.join("/tmp", "yapsec-msfrpcd.log")
    log = open(log_path, "a", encoding="utf-8")
    try:
        _msfrpcd_proc = subprocess.Popen(
            args,
            stdout=log,
            stderr=log,
            text=True,
            start_new_session=True,
        )
    except Exception as e:
        log.close()
        raise MsfBridgeError(f"failed to start msfrpcd: {e}") from e

    return {
        "ok": True,
        "running": True,
        "pid": _msfrpcd_proc.pid if _msfrpcd_proc else None,
        "available": True,
        "log_path": log_path,
        "host": cfg.host,
        "port": cfg.port,
        "ssl": cfg.ssl,
    }


def stop_daemon() -> dict[str, Any]:
    global _msfrpcd_proc, _client
    if _msfrpcd_proc is None or _msfrpcd_proc.poll() is not None:
        _msfrpcd_proc = None
        return {"ok": True, "running": False, "stopped": False}
    try:
        os.killpg(_msfrpcd_proc.pid, signal.SIGTERM)
    except Exception:
        _msfrpcd_proc.terminate()
    _msfrpcd_proc = None
    _client = None
    return {"ok": True, "running": False, "stopped": True}


def connected() -> bool:
    return _client is not None and bool(getattr(_client, "token", None) or getattr(_client, "authenticated", False))


def list_exploits(limit: int = 80) -> dict[str, Any]:
    if _client is None:
        raise MsfBridgeError("not connected — POST /api/msf/connect first")
    try:
        exploits = _client.modules.exploits
        if not isinstance(exploits, list):
            exploits = list(exploits)
        slim = exploits[: max(1, min(limit, 500))]
        return {"ok": True, "count": len(exploits), "exploits": slim}
    except Exception as e:
        raise MsfBridgeError(str(e)) from e


def search_exploits(query: str, limit: int = 80) -> dict[str, Any]:
    if _client is None:
        raise MsfBridgeError("not connected — POST /api/msf/connect first")
    try:
        q = query.strip().lower()
        if not q:
            return list_exploits(limit=limit)
        exploits = _client.modules.exploits
        if not isinstance(exploits, list):
            exploits = list(exploits)
        matched = [e for e in exploits if q in str(e).lower()]
        slim = matched[: max(1, min(limit, 500))]
        return {"ok": True, "query": query, "count": len(matched), "exploits": slim}
    except Exception as e:
        raise MsfBridgeError(str(e)) from e


def start_reverse_handler(
    lhost: str,
    lport: int,
    payload: str = "linux/x64/meterpreter/reverse_tcp",
) -> dict[str, Any]:
    """
    Starts exploit/multi/handler with the given payload (reverse listener).
    """
    if _client is None:
        raise MsfBridgeError("not connected — POST /api/msf/connect first")
    if not lhost or not lport:
        raise MsfBridgeError("lhost and lport required")
    try:
        handler = _client.modules.use("exploit", "multi/handler")
        pay = _client.modules.use("payload", payload)
        pay["LHOST"] = lhost
        pay["LPORT"] = str(lport)
        result = handler.execute(payload=pay)
        return {
            "ok": True,
            "payload": payload,
            "lhost": lhost,
            "lport": lport,
            "result": result,
        }
    except Exception as e:
        raise MsfBridgeError(str(e)) from e


def run_module(modtype: str, module: str, options: dict[str, str] | None = None) -> dict[str, Any]:
    """
    Generic (safe-ish) module launcher for easier GUI integration.
    """
    if _client is None:
        raise MsfBridgeError("not connected — POST /api/msf/connect first")
    if modtype not in {"auxiliary", "exploit"}:
        raise MsfBridgeError("unsupported modtype; use exploit or auxiliary")
    if not module.strip():
        raise MsfBridgeError("module name required")
    try:
        m = _client.modules.use(modtype, module.strip())
        for k, v in (options or {}).items():
            if v is None:
                continue
            m[str(k)] = str(v)
        result = m.execute()
        return {"ok": True, "modtype": modtype, "module": module, "result": result}
    except Exception as e:
        raise MsfBridgeError(str(e)) from e
