"""
YaPsec dependency engine: PATH checks + cross-platform install via sudo (apt, dnf, pacman).

Lab-only: installing packages from a web API is dangerous. Enable only with
YAPSEC_ALLOW_SUDO_INSTALL=1.
"""

from __future__ import annotations

import asyncio
import os
import shutil
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Literal

ToolStatus = Literal["missing", "ready", "installing", "error"]

INSTALL_LOCK = asyncio.Lock()
# id -> last install message / progress hint
_install_notes: dict[str, str] = {}


@dataclass(frozen=True)
class ToolSpec:
    id: str
    label: str
    binary: str
    packages: dict[str, str]
    category: str


TOOLS: tuple[ToolSpec, ...] = (
    ToolSpec("nmap", "Nmap", "nmap", {"pacman": "nmap", "apt": "nmap", "dnf": "nmap"}, "pentest"),
    ToolSpec("metasploit", "Metasploit", "msfconsole", {"pacman": "metasploit", "apt": "metasploit-framework", "dnf": "metasploit-framework"}, "pentest"),
    ToolSpec("sqlmap", "SQLmap", "sqlmap", {"pacman": "sqlmap", "apt": "sqlmap", "dnf": "sqlmap"}, "pentest"),
    ToolSpec("nuclei", "Nuclei", "nuclei", {"pacman": "nuclei", "apt": "nuclei", "dnf": "nuclei"}, "pentest"),
    ToolSpec("yapmetasploit", "YaPMetasploit", "yapmetasploit", {"pacman": "github:Xydroc-IO/YaP-Metasploit-GUI", "apt": "github:Xydroc-IO/YaP-Metasploit-GUI", "dnf": "github:Xydroc-IO/YaP-Metasploit-GUI"}, "pentest"),
    ToolSpec("aircrack", "Aircrack Suite", "airodump-ng", {"pacman": "aircrack-ng", "apt": "aircrack-ng", "dnf": "aircrack-ng"}, "pentest"),
    ToolSpec("lynis", "Lynis", "lynis", {"pacman": "lynis", "apt": "lynis", "dnf": "lynis"}, "audit"),
    ToolSpec("openscap", "OpenSCAP", "oscap", {"pacman": "openscap", "apt": "libopenscap8", "dnf": "openscap-scanner"}, "audit"),
    ToolSpec("checkov", "Checkov", "checkov", {"pacman": "checkov", "apt": "checkov", "dnf": "checkov"}, "audit"),
    ToolSpec("python-pip", "Python Pip", "pip", {"pacman": "python-pip", "apt": "python3-pip", "dnf": "python3-pip"}, "system"),
    ToolSpec("git", "Git", "git", {"pacman": "git", "apt": "git", "dnf": "git"}, "system"),
    ToolSpec("docker", "Docker", "docker", {"pacman": "docker", "apt": "docker.io", "dnf": "docker"}, "system"),
)

_runtime_status: dict[str, ToolStatus] = {t.id: "missing" for t in TOOLS}


def allow_sudo_install() -> bool:
    return os.environ.get("YAPSEC_ALLOW_SUDO_INSTALL", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _which(path: str) -> str | None:
    return shutil.which(path)

def detect_pm() -> str | None:
    if _which("apt-get"): return "apt"
    if _which("dnf"): return "dnf"
    if _which("pacman"): return "pacman"
    return None

def _yap_repo_dir() -> Path:
    return Path(os.environ.get("YAPMETASPLOIT_REPO_DIR", str(Path.home() / "YaP-Metasploit-GUI")))


def _yap_entry() -> Path:
    return Path(os.environ.get("YAPMETASPLOIT_GUI_ENTRY", str(_yap_repo_dir() / "core" / "metasploit_gui.py")))


def _yap_detect_path() -> str | None:
    for cand in ("yapmetasploit", "yapmetasploint"):
        p = _which(cand)
        if p:
            return p
    if _yap_entry().exists():
        return str(_yap_entry())
    return None


def refresh_detection() -> None:
    for t in TOOLS:
        if _runtime_status.get(t.id) == "installing":
            continue
        p = _yap_detect_path() if t.id == "yapmetasploit" else _which(t.binary)
        if p:
            _runtime_status[t.id] = "ready"
        elif _runtime_status.get(t.id) == "error":
            _runtime_status[t.id] = "error"
        else:
            _runtime_status[t.id] = "missing"


def ui_token(status: ToolStatus) -> Literal["grey", "blue", "green", "red"]:
    if status == "ready":
        return "green"
    if status == "installing":
        return "blue"
    if status == "error":
        return "red"
    return "grey"


def tools_snapshot() -> dict[str, Any]:
    refresh_detection()
    pm = detect_pm()
    out: list[dict[str, Any]] = []
    categories: dict[str, list[str]] = {"pentest": [], "audit": [], "system": []}
    for t in TOOLS:
        st = _runtime_status.get(t.id, "missing")
        path = (_yap_detect_path() if t.id == "yapmetasploit" else _which(t.binary)) if st == "ready" else None
        categories.setdefault(t.category, []).append(t.id)
        
        pkg_name = t.packages.get(pm, t.packages.get("pacman")) if pm else "unknown"
        out.append(
            {
                "id": t.id,
                "label": t.label,
                "binary": t.binary,
                "package": pkg_name,
                "category": t.category,
                "status": st,
                "ui": ui_token(st),
                "path": path,
                "note": _install_notes.get(t.id),
            }
        )
    return {
        "tools": out,
        "categories": categories,
        "install_enabled": allow_sudo_install(),
        "message": (
            "Set YAPSEC_ALLOW_SUDO_INSTALL=1 to enable one-click GUI installs (lab only)."
            if not allow_sudo_install()
            else "Package install API enabled — use only on trusted lab hosts."
        ),
    }


async def install_security_stack() -> dict[str, Any]:
    """
    One-click install for pentest/audit/system categories.
    """
    results: list[dict[str, Any]] = []
    for spec in TOOLS:
        if _which(spec.binary):
            _runtime_status[spec.id] = "ready"
            _install_notes[spec.id] = "already installed"
            results.append(
                {
                    "tool": spec.id,
                    "category": spec.category,
                    "ok": True,
                    "status": "ready",
                    "skipped": True,
                }
            )
            continue
        outcome = await install_tool(spec.id)
        outcome["category"] = spec.category
        results.append(outcome)
    ok_count = sum(1 for r in results if r.get("ok"))
    return {
        "ok": ok_count == len(results),
        "total": len(results),
        "ok_count": ok_count,
        "failed_count": len(results) - ok_count,
        "results": results,
    }


async def install_tool(tool_id: str) -> dict[str, Any]:
    spec = next((t for t in TOOLS if t.id == tool_id), None)
    if spec is None:
        return {"ok": False, "error": f"unknown tool: {tool_id}"}
    if not allow_sudo_install():
        return {
            "ok": False,
            "error": "install disabled",
            "hint": "export YAPSEC_ALLOW_SUDO_INSTALL=1",
        }

    pm = detect_pm()
    if not pm:
        return {"ok": False, "error": "No supported package manager found (apt, dnf, pacman)"}

    async with INSTALL_LOCK:
        _runtime_status[tool_id] = "installing"
        if tool_id == "yapmetasploit":
            _install_notes[tool_id] = "cloning YaP-Metasploit-GUI from GitHub …"
            try:
                repo = _yap_repo_dir()
                entry = _yap_entry()
                repo.parent.mkdir(parents=True, exist_ok=True)

                if repo.exists() and (repo / ".git").exists():
                    proc = await asyncio.create_subprocess_exec(
                        "git",
                        "-C",
                        str(repo),
                        "pull",
                        "--ff-only",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                else:
                    proc = await asyncio.create_subprocess_exec(
                        "git",
                        "clone",
                        "https://github.com/Xydroc-IO/YaP-Metasploit-GUI.git",
                        str(repo),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                out_b, err_b = await proc.communicate()
                stdout = (out_b or b"").decode(errors="replace")[-8000:]
                stderr = (err_b or b"").decode(errors="replace")[-8000:]
                if proc.returncode == 0 and entry.exists():
                    _runtime_status[tool_id] = "ready"
                    _install_notes[tool_id] = f"installed from github at {repo}"
                    return {
                        "ok": True,
                        "tool": tool_id,
                        "returncode": proc.returncode,
                        "stdout": stdout,
                        "stderr": stderr,
                        "status": "ready",
                        "ui": "green",
                        "repo": str(repo),
                        "entry": str(entry),
                        "source": "github",
                    }
                _runtime_status[tool_id] = "error"
                _install_notes[tool_id] = (stderr.strip() or "github install failed")[:500]
                return {
                    "ok": False,
                    "tool": tool_id,
                    "returncode": proc.returncode,
                    "stdout": stdout,
                    "stderr": stderr,
                    "status": "error",
                    "ui": "red",
                    "repo": str(repo),
                    "entry": str(entry),
                    "source": "github",
                }
            except Exception as e:
                _runtime_status[tool_id] = "error"
                _install_notes[tool_id] = str(e)
                return {"ok": False, "tool": tool_id, "error": str(e), "status": "error", "ui": "red"}

        pkg_name = spec.packages.get(pm, spec.packages.get("pacman"))
        
        sudo_cmd = "pkexec" if _which("pkexec") else "sudo"
        cmd = []
        if pm == "apt":
            cmd = [sudo_cmd, "apt-get", "install", "-y", pkg_name]
        elif pm == "dnf":
            cmd = [sudo_cmd, "dnf", "install", "-y", pkg_name]
        elif pm == "pacman":
            cmd = [sudo_cmd, "pacman", "-S", "--noconfirm", "--needed", pkg_name]

        _install_notes[tool_id] = f"running {' '.join(cmd)} …"
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            out_b, err_b = await proc.communicate()
            stdout = (out_b or b"").decode(errors="replace")[-8000:]
            stderr = (err_b or b"").decode(errors="replace")[-8000:]
            if proc.returncode == 0:
                _runtime_status[tool_id] = "ready"
                _install_notes[tool_id] = "install completed"
                return {
                    "ok": True,
                    "tool": tool_id,
                    "returncode": proc.returncode,
                    "stdout": stdout,
                    "stderr": stderr,
                    "status": "ready",
                    "ui": "green",
                }
            _runtime_status[tool_id] = "error"
            _install_notes[tool_id] = stderr.strip()[:500] or f"exit {proc.returncode}"
            return {
                "ok": False,
                "tool": tool_id,
                "returncode": proc.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "status": "error",
                "ui": "red",
            }
        except Exception as e:
            _runtime_status[tool_id] = "error"
            _install_notes[tool_id] = str(e)
            return {"ok": False, "tool": tool_id, "error": str(e), "status": "error", "ui": "red"}
        finally:
            refresh_detection()
