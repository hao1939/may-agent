FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg2 \
    jq \
    procps \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome stable
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends google-chrome-stable && \
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

# Copy local dependencies (file: links in package.json)
COPY pi-deps/agent /pi-deps/agent
COPY pi-deps/ai /pi-deps/ai

# Install dependencies
COPY package.json package-lock.json ./
RUN sed -i 's|file:/home/hao/pi-mono/packages/agent|file:/pi-deps/agent|' package.json && \
    sed -i 's|file:/home/hao/pi-mono/packages/ai|file:/pi-deps/ai|' package.json && \
    npm install --ignore-scripts && \
    npm install -g tsx

# Copy source (lib + app are both under src/)
COPY src/ src/
COPY tsconfig.json tsconfig.build.json ./

# Copy entrypoints and helpers
COPY docker/entrypoint.sh docker/entrypoint-console.sh docker/restart-may.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint-console.sh /usr/local/bin/restart-may.sh

# Virtual display
ENV DISPLAY=:99

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
