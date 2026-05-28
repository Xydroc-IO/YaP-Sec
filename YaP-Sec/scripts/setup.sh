#!/usr/bin/env bash
# YaPsec — robust dependency bootstrap (Cross-Platform).
# Run manually on a lab host; review before executing with root privileges.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[YaPsec] Root: $ROOT"

# System Package Manager Detection
PM=""
SUDO_CMD="sudo"
if command -v pkexec >/dev/null 2>&1; then
  SUDO_CMD="pkexec"
fi

if command -v apt-get >/dev/null 2>&1; then
  PM="apt"
  echo "[YaPsec] Detected apt — syncing package DB."
  $SUDO_CMD apt-get update
elif command -v dnf >/dev/null 2>&1; then
  PM="dnf"
  echo "[YaPsec] Detected dnf."
elif command -v pacman >/dev/null 2>&1; then
  PM="pacman"
  echo "[YaPsec] Detected pacman — syncing package DB."
  $SUDO_CMD pacman -Sy --noconfirm
else
  echo "[YaPsec] WARN: No supported package manager found (apt, dnf, pacman)."
  echo "[YaPsec] Skipping system package install."
fi

if [[ -n "$PM" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "[YaPsec] Installing python3..."
    if [[ "$PM" == "apt" ]]; then $SUDO_CMD apt-get install -y python3 python3-venv python3-pip; fi
    if [[ "$PM" == "dnf" ]]; then $SUDO_CMD dnf install -y python3; fi
    if [[ "$PM" == "pacman" ]]; then $SUDO_CMD pacman -S --noconfirm --needed python; fi
  fi
  
  if command -v python3 >/dev/null 2>&1; then
    echo "[YaPsec] Installing system dependencies via Python script..."
    python3 "$ROOT/scripts/install_dependencies.py"
  else
    echo "[YaPsec] ERROR: python3 not found. Install Python first."
    exit 1
  fi
fi

if [[ -d backend ]]; then
  echo "[YaPsec] Python venv + pip requirements (backend)."
  if ! command -v python3 >/dev/null 2>&1; then
    echo "[YaPsec] ERROR: python3 not found. Install Python first."
    exit 1
  fi
  
  # Ensure python3-venv is installed on debian-based systems
  if [[ "$PM" == "apt" ]] && ! dpkg -s python3-venv >/dev/null 2>&1; then
      echo "[YaPsec] Installing python3-venv (required for Debian/Ubuntu)..."
      $SUDO_CMD apt-get install -y python3-venv || true
  fi

  python3 -m venv backend/.venv
  # shellcheck disable=SC1091
  source backend/.venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r backend/requirements.txt
  deactivate
fi

if [[ -d frontend ]]; then
  echo "[YaPsec] npm install (frontend)."
  if command -v npm >/dev/null 2>&1; then
    (cd frontend && npm install && npm audit fix || true)
  else
    echo "[YaPsec] WARN: npm not found; skipping frontend deps."
  fi
fi

echo "[YaPsec] Done. Start API: cd backend && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "[YaPsec] Optional: export YAPSEC_ALLOW_SUDO_INSTALL=1 before uvicorn to enable GUI pacman/apt/dnf installs."
