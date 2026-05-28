#!/usr/bin/env bash
# Launches the YaPsec GUI Launcher.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[YaPsec] ERROR: python3 not found. Please install Python first or run setup.sh."
  exit 1
fi

python3 scripts/gui_launcher.py
