ARG NODE_IMAGE=node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
ARG DEBIAN_IMAGE=debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818

# ── Builder stage: compile standalone binary ──────────────────────────────
FROM ${NODE_IMAGE} AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    g++ \
    make \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (pinned)
ARG BUN_VERSION=bun-v1.3.14
RUN curl -fsSL https://bun.sh/install | bash -s "$BUN_VERSION" && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    /usr/local/bin/bun --version

WORKDIR /build

# Install dependencies. Keep this workspace manifest list in sync with
# package.json workspaces and WORKSPACE_PACKAGE_DIRS below.
COPY package.json bun.lock ./
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/control/package.json packages/control/package.json
COPY packages/terminal/package.json packages/terminal/package.json
COPY packages/webui/package.json packages/webui/package.json
RUN bun install --frozen-lockfile

# Copy source + config
COPY src/ src/
COPY packages/ packages/
COPY tsconfig.json ./

ARG WORKSPACE_PACKAGE_DIRS="packages/control packages/sdk packages/terminal packages/webui"
RUN actual="$(find packages -mindepth 2 -maxdepth 2 -name package.json -printf '%h\n' | sort | xargs)" && \
    test "$actual" = "$WORKSPACE_PACKAGE_DIRS" || \
    (printf 'Workspace package list drifted.\nExpected: %s\nActual:   %s\nUpdate Dockerfile workspace manifest COPY lines and WORKSPACE_PACKAGE_DIRS.\n' "$WORKSPACE_PACKAGE_DIRS" "$actual" >&2; exit 1)

# Compile standalone binary
RUN bun build --compile src/app/binary-entry.ts --outfile /build/may-agent

# ── Runtime stage: minimal image with Chrome + GUI ────────────────────────
FROM ${DEBIAN_IMAGE}

RUN apt-get update && apt-get install -y --no-install-recommends \
    bubblewrap \
    ca-certificates \
    curl \
    git \
    gnupg2 \
    jq \
    openssh-client \
    procps \
    socat \
    supervisor \
    tmux \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome/Chromium (arch-aware: Google Chrome is amd64-only)
RUN apt-get update && \
    if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
      curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list && \
      apt-get update && \
      apt-get install -y --no-install-recommends google-chrome-stable; \
    else \
      apt-get install -y --no-install-recommends chromium; \
    fi && \
    apt-get clean -y && \
    rm -rf /var/lib/apt/lists/*

# Headed Chrome GUI stack (Xvfb + VNC + noVNC)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dbus-x11 \
    fluxbox \
    fonts-noto-cjk \
    novnc \
    websockify \
    x11vnc \
    xvfb \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create user for uid 1000 before copying runtime files that it should own.
RUN useradd -u 1000 -d /app/.state -s /bin/bash mayagent 2>/dev/null || true

# Runtime Node/npm comes from the pinned builder image. This avoids the extra
# NodeSource apt repository while keeping agent shell commands on Node 24 LTS.
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Install CLI agent tools (claude-code, codex) used as worker agents. They use
# the configured model endpoint; keep versions pinned so image rebuilds do not
# silently change agent behavior.
ARG CLAUDE_CODE_VERSION=2.1.218
ARG CODEX_VERSION=0.145.0
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} @openai/codex@${CODEX_VERSION} \
    && test "$(claude --version | awk '{print $1}')" = "${CLAUDE_CODE_VERSION}" \
    && test "$(codex --version | awk '{print $2}')" = "${CODEX_VERSION}" \
    && claude --help | grep -q -- '--output-format' \
    && claude --help | grep -q -- '--resume' \
    && codex exec --help | grep -q -- '--output-last-message' \
    && codex exec resume --help | grep -q -- '--last' \
    && npm cache clean --force

# Copy compiled runtime tools from builder. The service runs from the standalone
# may-agent binary, but agent/operator commands and docs assume `bun` exists.
COPY --from=builder --chown=mayagent:mayagent /build/may-agent /usr/local/bin/may-agent
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /build/packages/terminal/node_modules/node-pty /app/node_modules/node-pty
RUN node -e "const p = require('/app/node_modules/node-pty'); if (typeof p.spawn !== 'function') process.exit(1)"
COPY packages/terminal/bin/terminal-bridge.cjs /app/packages/terminal/bin/terminal-bridge.cjs

# Copy the default May Agent project UI for image-only runs. Local compose
# mounts /app from the host, so the host project tree is the source of truth.
COPY packages/webui/static/ /app/projects/platform/ui/
RUN mkdir -p /app/projects/platform/ui/vendor/xterm
COPY --from=builder /build/node_modules/@xterm/xterm/lib/xterm.js /app/projects/platform/ui/vendor/xterm/xterm.js
COPY --from=builder /build/node_modules/@xterm/xterm/css/xterm.css /app/projects/platform/ui/vendor/xterm/xterm.css
COPY --from=builder /build/node_modules/@xterm/addon-fit/lib/addon-fit.js /app/projects/platform/ui/vendor/xterm/addon-fit.js

# CLI agent config (Codex needs config.toml for the shared model endpoint).
COPY container/codex-config.toml /etc/codex/config.toml

# Copy supervisord config
COPY container/supervisord.conf /etc/supervisord.conf
RUN mkdir -p /app/.state/runtime-logs && chown -R mayagent:mayagent /app/.state/runtime-logs

# Copy entrypoints and helpers
COPY container/entrypoint.sh container/start-chrome.sh container/setup-codex-config.sh container/may-agent-supervisor-restart.sh /usr/local/bin/
COPY packages/terminal/bin/may-console.cjs /usr/local/bin/may-console
RUN chmod 755 /usr/local/bin/may-agent /usr/local/bin/entrypoint.sh /usr/local/bin/start-chrome.sh /usr/local/bin/setup-codex-config.sh /usr/local/bin/may-agent-supervisor-restart.sh /usr/local/bin/may-console && \
    ln -sf /usr/local/bin/may-agent-supervisor-restart.sh /usr/local/bin/may-agent-supervisor-restart

# Virtual display
ENV DISPLAY=:99

# Chrome 146+ crashpad handler needs a writable $HOME to create
# $HOME/.config/google-chrome/Crash Reports — without it Chrome
# SIGTRAPs immediately when running as a non-root user.
ENV HOME=/app/.state

ENV NODE_ENV=production
ENV PROJECT_ROOT=/app
ENV AGENTS_ROOT=/app/agents
ENV SHARED_ROOT=/app/shared
ENV PROJECTS_ROOT=/app/projects
ENV STATE_DIR=/app/.state
ENV PATH=/usr/local/bin:$PATH

# noVNC web interface
EXPOSE 6080

# Web UI dashboard
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
