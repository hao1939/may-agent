# ── Builder stage: compile standalone binary ──────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /build

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source + config
COPY src/ src/
COPY tsconfig.json ./

# Compile standalone binary
RUN bun build --compile src/app/binary-entry.ts --outfile /build/may-agent && \
    bun build --compile src/app/ui/web.ts --outfile /build/may-agent-web

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

# Copy compiled binaries from builder
COPY --from=builder /build/may-agent /usr/local/bin/may-agent

# Compile web UI as standalone binary (runs independently of may-agent)
COPY --from=builder /build/may-agent-web /usr/local/bin/may-agent-web

# Copy web UI static files (not embedded in compiled binary)
COPY src/app/ui/web-static/ /usr/local/share/may-agent-web/web-static/

# Copy entrypoints and helpers
COPY container/entrypoint.sh container/entrypoint-console.sh container/restart-may.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint-console.sh /usr/local/bin/restart-may.sh

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
ENV STATE_DIR=/app/.state

# noVNC web interface
EXPOSE 6080

# Restart agent without restarting container:
#   docker exec <container> restart-may.sh
#   docker exec <container> restart-may.sh --force  # skip socket, kill directly
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
