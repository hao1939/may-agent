# ── Builder stage: compile standalone binary ──────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (pinned)
ARG BUN_VERSION=bun-v1.3.14
RUN curl -fsSL https://bun.sh/install | bash -s "$BUN_VERSION" && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    /usr/local/bin/bun --version

WORKDIR /build

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source + config
COPY src/ src/
COPY packages/ packages/
COPY tsconfig.json ./

# Compile standalone binary
RUN bun build --compile src/app/binary-entry.ts --outfile /build/may-agent

# ── Runtime stage: minimal image with Chrome + GUI ────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg2 \
    jq \
    openssh-client \
    procps \
    socat \
    supervisor \
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

# Node.js 22 — novnc pulls in nodejs 18, but agents' bash commands
# use node to run scripts with native modules (better-sqlite3) compiled
# for the host's Node 22. Override with matching version.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CLI agent tools (claude-code, codex) — used as worker agents
# They route through litellm proxy for model access
RUN npm install -g @anthropic-ai/claude-code @openai/codex 2>/dev/null || true

# Copy compiled runtime tools from builder. The service runs from the standalone
# may-agent binary, but agent/operator commands and docs assume `bun` exists.
COPY --from=builder /build/may-agent /usr/local/bin/may-agent
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

# Copy the default May Agent project UI for image-only runs. Local compose
# mounts /app from the host, so the host project tree is the source of truth.
COPY ui/ /app/projects/platform/ui/

# CLI agent configs (codex needs config.toml to route through litellm)
COPY container/codex-config.toml /etc/codex/config.toml

# Copy supervisord config
COPY container/supervisord.conf /etc/supervisord.conf

# Copy entrypoints and helpers
COPY container/entrypoint.sh container/start-chrome.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/start-chrome.sh

# Create user for uid 1000 (SSH requires a passwd entry)
RUN useradd -u 1000 -d /app/.state -s /bin/bash mayagent 2>/dev/null || true

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
