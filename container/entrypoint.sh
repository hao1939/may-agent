#!/bin/bash
set -e

export INSTANCE="${INSTANCE:-background}"
export DISPLAY=:99
export STATE_DIR="${STATE_DIR:-/app/.state}"

# Chrome binary (arch-dependent)
export CHROME_BIN=""
[ -x /opt/google/chrome/chrome ] && export CHROME_BIN=/opt/google/chrome/chrome
[ -z "$CHROME_BIN" ] && [ -x /usr/bin/chromium ] && export CHROME_BIN=/usr/bin/chromium
mkdir -p /app/.state/chrome-profile

# may-agent args for supervisord
export MAY_ARGS="--chat --cron --telegram --console --socket --web"

# SSH config
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
if ! grep -q "StrictHostKeyChecking accept-new" "${HOME}/.ssh/config" 2>/dev/null; then
  printf "Host *\n  StrictHostKeyChecking accept-new\n" >> "${HOME}/.ssh/config"
  chmod 600 "${HOME}/.ssh/config"
fi
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i ${HOME}/.ssh/id_rsa"

# Add host node bin to PATH for CLI coding agents (claude, codex, gemini)
for d in /home/example-user/.nvm/versions/node/*/bin; do [ -d "$d" ] && export PATH="$d:$PATH" && break; done

# Ensure .state/ is writable by mayagent (uid 1000)
chown -R mayagent:mayagent /app/.state /app/agents 2>/dev/null || true
exec supervisord -c /etc/supervisord.conf
