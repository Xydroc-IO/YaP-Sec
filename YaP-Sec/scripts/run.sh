#!/usr/bin/env bash
# One-place launcher for YaPsec (backend + frontend).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
STARTED_BACKEND=0
API_URL_ENV="${VITE_API_URL:-}"
WS_URL_ENV="${VITE_WS_URL:-}"

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "[YaPsec] backend/ or frontend/ folder missing."
  exit 1
fi

is_port_listening() {
  local port="$1"
  ss -ltn "( sport = :$port )" | rg -q ":$port"
}

is_yapsec_backend() {
  local port="$1"
  local body
  body="$(curl -fsS "http://127.0.0.1:$port/health" 2>/dev/null || true)"
  echo "$body" | rg -q '"status"[[:space:]]*:[[:space:]]*"ok"'
}

next_free_port() {
  local start="$1"
  local p
  for p in $(seq "$start" $((start + 20))); do
    if ! is_port_listening "$p"; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

cleanup() {
  echo
  echo "[YaPsec] Stopping services..."
  if [[ "${STARTED_BACKEND:-0}" -eq 1 ]] && [[ -n "${BACK_PID:-}" ]] && kill -0 "$BACK_PID" 2>/dev/null; then
    kill "$BACK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[YaPsec] Root: $ROOT"

if [[ ! -x "$BACKEND_DIR/.venv/bin/python" ]] || [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]] || ! "$BACKEND_DIR/.venv/bin/uvicorn" --version >/dev/null 2>&1; then
  echo "[YaPsec] Creating (or recreating) backend venv..."
  rm -rf "$BACKEND_DIR/.venv"
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/python" -m pip install --upgrade pip
  "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[YaPsec] Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if is_port_listening "$BACKEND_PORT"; then
  if is_yapsec_backend "$BACKEND_PORT"; then
    echo "[YaPsec] YaPsec backend already running on :$BACKEND_PORT. Reusing it."
    STARTED_BACKEND=0
  else
    ALT_BACKEND_PORT="$(next_free_port 8001 || true)"
    if [[ -z "${ALT_BACKEND_PORT:-}" ]]; then
      echo "[YaPsec] Port :$BACKEND_PORT is occupied by non-YaPsec service and no free fallback port found."
      exit 1
    fi
    BACKEND_PORT="$ALT_BACKEND_PORT"
    echo "[YaPsec] Port :8000 is occupied by non-YaPsec service. Starting YaPsec backend on :$BACKEND_PORT"
    "$BACKEND_DIR/.venv/bin/uvicorn" main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" --app-dir "$BACKEND_DIR" &
    BACK_PID=$!
    STARTED_BACKEND=1
  fi
else
  echo "[YaPsec] Starting backend on :$BACKEND_PORT"
  "$BACKEND_DIR/.venv/bin/uvicorn" main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" --app-dir "$BACKEND_DIR" &
  BACK_PID=$!
  STARTED_BACKEND=1
fi

sleep 1
if [[ "${STARTED_BACKEND:-0}" -eq 1 ]] && ! kill -0 "$BACK_PID" 2>/dev/null; then
  echo "[YaPsec] Backend failed to start."
  exit 1
fi

echo "[YaPsec] Starting frontend on :$FRONTEND_PORT"
if is_port_listening "$FRONTEND_PORT"; then
  ALT_FRONTEND_PORT="$(next_free_port 5174 || true)"
  if [[ -z "${ALT_FRONTEND_PORT:-}" ]]; then
    echo "[YaPsec] Frontend port :$FRONTEND_PORT is busy and no free fallback was found."
    exit 1
  fi
  FRONTEND_PORT="$ALT_FRONTEND_PORT"
  echo "[YaPsec] Frontend port busy, switching to :$FRONTEND_PORT"
fi
echo "[YaPsec] Open: http://localhost:$FRONTEND_PORT"
cd "$FRONTEND_DIR"
if [[ "$BACKEND_PORT" != "8000" ]]; then
  API_URL_ENV="http://127.0.0.1:$BACKEND_PORT"
  WS_URL_ENV="ws://127.0.0.1:$BACKEND_PORT/ws/feed"
fi
echo "[YaPsec] API target: ${API_URL_ENV:-<vite-proxy>}"
echo "[YaPsec] WS target: ${WS_URL_ENV:-<vite-proxy /ws/feed>}"
VITE_API_URL="$API_URL_ENV" VITE_WS_URL="$WS_URL_ENV" npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
