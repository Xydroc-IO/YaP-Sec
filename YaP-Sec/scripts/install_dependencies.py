#!/usr/bin/env python3
"""
YaPsec dependency installer (Cross-Platform).

- Detects package manager (apt, dnf, pacman)
- Checks PATH for required binaries
- Installs missing packages using the appropriate manager
- Emits JSON status for GUI/progress integration

Usage:
  python install_dependencies.py
  python install_dependencies.py --category pentest
  python install_dependencies.py --json
  python install_dependencies.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Literal

Category = Literal["pentest", "audit", "system"]

@dataclass(frozen=True)
class Tool:
    id: str
    binary: str
    packages: dict[str, str]
    category: Category


TOOLS: tuple[Tool, ...] = (
    Tool("nmap", "nmap", {"pacman": "nmap", "apt": "nmap", "dnf": "nmap"}, "pentest"),
    Tool("metasploit", "msfconsole", {"pacman": "metasploit", "apt": "metasploit-framework", "dnf": "metasploit-framework"}, "pentest"),
    Tool("sqlmap", "sqlmap", {"pacman": "sqlmap", "apt": "sqlmap", "dnf": "sqlmap"}, "pentest"),
    Tool("nuclei", "nuclei", {"pacman": "nuclei", "apt": "nuclei", "dnf": "nuclei"}, "pentest"),
    Tool("yapmetasploit", "yapmetasploit", {"pacman": "github:Xydroc-IO/YaP-Metasploit-GUI", "apt": "github:Xydroc-IO/YaP-Metasploit-GUI", "dnf": "github:Xydroc-IO/YaP-Metasploit-GUI"}, "pentest"),
    Tool("lynis", "lynis", {"pacman": "lynis", "apt": "lynis", "dnf": "lynis"}, "audit"),
    Tool("openscap", "oscap", {"pacman": "openscap", "apt": "libopenscap8", "dnf": "openscap-scanner"}, "audit"),
    Tool("checkov", "checkov", {"pacman": "checkov", "apt": "checkov", "dnf": "checkov"}, "audit"),
    Tool("git", "git", {"pacman": "git", "apt": "git", "dnf": "git"}, "system"),
    Tool("docker", "docker", {"pacman": "docker", "apt": "docker.io", "dnf": "docker"}, "system"),
    Tool("python-pip", "pip", {"pacman": "python-pip", "apt": "python3-pip", "dnf": "python3-pip"}, "system"),
)


def which(bin_name: str) -> str | None:
    return shutil.which(bin_name)


def detect_pm() -> str | None:
    if which("apt-get"): return "apt"
    if which("dnf"): return "dnf"
    if which("pacman"): return "pacman"
    return None


def run_cmd(cmd: list[str], dry_run: bool) -> dict:
    if dry_run:
        return {"ok": True, "returncode": 0, "stdout": "[dry-run]", "stderr": "", "command": cmd}
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "stdout": (proc.stdout or "")[-8000:],
        "stderr": (proc.stderr or "")[-8000:],
        "command": cmd,
    }


def get_sudo_cmd() -> str:
    return "pkexec" if shutil.which("pkexec") else "sudo"

def run_install(pm: str, package: str, use_sudo: bool, dry_run: bool) -> dict:
    cmd = []
    if use_sudo:
        cmd.append(get_sudo_cmd())
        
    if pm == "apt":
        cmd.extend(["apt-get", "install", "-y", package])
    elif pm == "dnf":
        cmd.extend(["dnf", "install", "-y", package])
    elif pm == "pacman":
        cmd.extend(["pacman", "-S", "--noconfirm", "--needed", package])
    else:
        return {"ok": False, "error": f"Unsupported PM: {pm}"}

    return run_cmd(cmd, dry_run)


def yap_repo_dir() -> Path:
    return Path(os.environ.get("YAPMETASPLOIT_REPO_DIR", str(Path.home() / "YaP-Metasploit-GUI")))


def yap_entry() -> Path:
    return Path(os.environ.get("YAPMETASPLOIT_GUI_ENTRY", str(yap_repo_dir() / "core" / "metasploit_gui.py")))


def yap_detect() -> str | None:
    for cand in ("yapmetasploit", "yapmetasploint"):
        p = which(cand)
        if p:
            return p
    if yap_entry().exists():
        return str(yap_entry())
    return None


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--category", choices=["pentest", "audit", "system", "all"], default="all")
    p.add_argument("--json", action="store_true", help="Output only JSON")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-sudo", action="store_true")
    args = p.parse_args()

    pm = detect_pm()
    if not pm:
        payload = {"ok": False, "error": "No supported package manager found (apt, dnf, pacman)", "results": []}
        print(json.dumps(payload, indent=2))
        return 2

    selected = [
        t for t in TOOLS if args.category == "all" or t.category == args.category
    ]

    results: list[dict] = []
    for t in selected:
        path = yap_detect() if t.id == "yapmetasploit" else which(t.binary)
        if path:
            results.append(
                {
                    "tool": t.id,
                    "category": t.category,
                    "status": "ready",
                    "ok": True,
                    "path": path,
                    "skipped": True,
                }
            )
            continue

        if t.id == "yapmetasploit":
            repo = yap_repo_dir()
            entry = yap_entry()
            repo.parent.mkdir(parents=True, exist_ok=True)
            if repo.exists() and (repo / ".git").exists():
                install = run_cmd(["git", "-C", str(repo), "pull", "--ff-only"], args.dry_run)
            else:
                install = run_cmd(
                    ["git", "clone", "https://github.com/Xydroc-IO/YaP-Metasploit-GUI.git", str(repo)],
                    args.dry_run,
                )
            ok = install["ok"] and (args.dry_run or entry.exists())
            results.append(
                {
                    "tool": t.id,
                    "category": t.category,
                    "status": "ready" if ok else "error",
                    "ok": ok,
                    "package": "github:YaPMetasploit",
                    "command": install["command"],
                    "returncode": install["returncode"],
                    "stdout": install["stdout"],
                    "stderr": install["stderr"],
                    "repo": str(repo),
                    "entry": str(entry),
                    "source": "github",
                }
            )
            continue

        pkg_name = t.packages.get(pm, t.packages.get("pacman"))
        install = run_install(pm, pkg_name, use_sudo=not args.no_sudo, dry_run=args.dry_run)
        
        # Fallbacks for packages not in enabled repos
        if not install["ok"] and t.id == "openscap" and pm == "pacman":
            if shutil.which("yay"):
                install = run_cmd(["yay", "-S", "--noconfirm", "--needed", "openscap"], args.dry_run)
                if not install["ok"]:
                    install = run_cmd(["yay", "-S", "--noconfirm", "--needed", "openscap-git"], args.dry_run)
                    
        if not install["ok"] and t.id == "checkov":
            pipx = shutil.which("pipx")
            if not pipx and not args.dry_run:
                pipx_pkg = "pipx" if pm in ["apt", "dnf"] else "python-pipx"
                bootstrap = run_install(pm, pipx_pkg, use_sudo=not args.no_sudo, dry_run=False)
                if bootstrap["ok"]:
                    pipx = shutil.which("pipx")
            if pipx:
                install = run_cmd([pipx, "install", "checkov"], args.dry_run)
                
        status = "ready" if install["ok"] else "error"
        results.append(
            {
                "tool": t.id,
                "category": t.category,
                "status": status,
                "ok": install["ok"],
                "package": pkg_name,
                "command": install["command"],
                "returncode": install.get("returncode", -1),
                "stdout": install.get("stdout", ""),
                "stderr": install.get("stderr", ""),
            }
        )

    ok_count = sum(1 for r in results if r.get("ok"))
    payload = {
        "ok": ok_count == len(results),
        "total": len(results),
        "ok_count": ok_count,
        "failed_count": len(results) - ok_count,
        "results": results,
    }

    if args.json:
        print(json.dumps(payload))
    else:
        print(json.dumps(payload, indent=2))

    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
