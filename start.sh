#!/bin/bash
set -e

cd "$(dirname "$0")"

# Load .env
set -a
source .env
set +a

export INSTANCE="${INSTANCE:-local}"
export STATE_DIR="${STATE_DIR:-.state}"
export PROJECT_ROOT="$(pwd)"
export AGENTS_ROOT="$(pwd)/agents"
export DISPLAY=:99

# Chrome binary
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && command -v google-chrome-stable &>/dev/null && export CHROME_BIN="$(command -v google-chrome-stable)"
[ -z "$CHROME_BIN" ] && command -v chromium &>/dev/null && export CHROME_BIN="$(command -v chromium)"

mkdir -p "$STATE_DIR/chrome-profile-local"

cleanup() {
  echo "Shutting down..."
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT

# ── Virtual display + VNC ──────────────────────────────────────────────
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &>/dev/null &
sleep 1
fluxbox &>/dev/null &
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -quiet -xkb -noxrecord -noxfixes -noxdamage &>/dev/null &
websockify --web /usr/share/novnc 6080 localhost:5900 &>/dev/null &

# ── Chrome ─────────────────────────────────────────────────────────────
if [ -n "$CHROME_BIN" ]; then
  "$CHROME_BIN" --no-sandbox --disable-gpu --no-first-run --disable-dev-shm-usage \
    --start-maximized --remote-debugging-port=9222 \
    --user-data-dir="$STATE_DIR/chrome-profile-local" &>/dev/null &
fi

echo "noVNC: http://localhost:6080"
echo "Web UI: http://localhost:8080"

# ── may-agent ──────────────────────────────────────────────────────────
exec bun src/app/may.ts --chat --cron --console --socket --web "$@"
