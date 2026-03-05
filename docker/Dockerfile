FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg2 \
    jq \
    procps \
    socat \
    supervisor \
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
    npm install --ignore-scripts

# Copy source
COPY src/ src/
COPY run/ run/
COPY tsconfig.json tsconfig.build.json ./

# Copy entrypoints
COPY docker/entrypoint.sh docker/entrypoint-console.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint-console.sh

# Virtual display
ENV DISPLAY=:99

ENV NODE_ENV=production
ENV PROJECT_ROOT=/app
ENV AGENTS_ROOT=/app/agents
ENV STATE_DIR=/app/.state

# noVNC web interface
EXPOSE 6080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
