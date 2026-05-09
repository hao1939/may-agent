#!/bin/sh
set -eu

profile="${CHROME_PROFILE_DIR:-/app/.state/chrome-profile}"
mkdir -p "$profile"

# Chrome persists Singleton* locks in the mounted profile. After a container
# stop/restart the old PID cannot be valid inside the new supervisor process,
# but Chrome still refuses to start until the stale lock is removed.
rm -f "$profile"/SingletonLock "$profile"/SingletonSocket "$profile"/SingletonCookie

exec "${CHROME_BIN}" \
  --no-sandbox \
  --disable-gpu \
  --no-first-run \
  --disable-dev-shm-usage \
  --start-maximized \
  --remote-debugging-port=9222 \
  --user-data-dir="$profile"
