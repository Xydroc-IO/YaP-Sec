#!/usr/bin/env bash
# Automatically sets up dependencies and launches YaPsec

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[YaPsec] Auto setup started..."

echo "[YaPsec] Running setup.sh to configure everything..."
bash "$ROOT/scripts/setup.sh"

echo "[YaPsec] Launching app..."
exec "$ROOT/scripts/run.sh"
