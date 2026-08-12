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
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Keep both web-terminal binaries pinned and checksum-verified so rebuilding
# the image cannot silently change the terminal stack.
ARG HERDR_VERSION=0.8.0
ARG HERDR_AMD64_SHA256=b872ea7e40fa2cb17e857ac9b62b1bf26db7b403c622f5d2f3f5b35f6e9acd28
ARG HERDR_ARM64_SHA256=f647ac66468d9efbc642fe534fb284468f0aea60641606fc008dfc0d82a3ca87
ARG TTYD_VERSION=1.7.7
ARG TTYD_AMD64_SHA256=8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55
ARG TTYD_ARM64_SHA256=b38acadd89d1d396a0f5649aa52c539edbad07f4bc7348b27b4f4b7219dd4165
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) herdr_arch=x86_64; herdr_sha="${HERDR_AMD64_SHA256}"; ttyd_arch=x86_64; ttyd_sha="${TTYD_AMD64_SHA256}" ;; \
      arm64) herdr_arch=aarch64; herdr_sha="${HERDR_ARM64_SHA256}"; ttyd_arch=aarch64; ttyd_sha="${TTYD_ARM64_SHA256}" ;; \
      *) echo "Unsupported terminal architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL --retry 3 \
      "https://github.com/herdrdev/herdr/releases/download/v${HERDR_VERSION}/herdr-linux-${herdr_arch}" \
      -o /usr/local/bin/herdr; \
    echo "${herdr_sha}  /usr/local/bin/herdr" | sha256sum -c -; \
    curl -fsSL --retry 3 \
      "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${ttyd_arch}" \
      -o /usr/local/bin/ttyd; \
    echo "${ttyd_sha}  /usr/local/bin/ttyd" | sha256sum -c -; \
    chmod 755 /usr/local/bin/herdr /usr/local/bin/ttyd; \
    herdr --version; \
    ttyd --version

# Derive a custom ttyd index from the checksum-pinned binary. It is patched
# after Node is installed below so Herdr's OSC-52 copies can reach the browser
# clipboard without giving up Herdr's mouse UI.
RUN set -eux; \
    mkdir -p /usr/local/share/ttyd; \
    ttyd --interface 127.0.0.1 --port 17681 /bin/true >/tmp/ttyd-index.log 2>&1 & \
    terminal_ttyd_pid="$!"; \
    curl -fsS --retry 20 --retry-connrefused --retry-delay 1 \
      http://127.0.0.1:17681/ \
      -o /usr/local/share/ttyd/index.html; \
    kill "${terminal_ttyd_pid}" || true; \
    wait "${terminal_ttyd_pid}" || true

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

# ttyd copies only browser-owned xterm selections. Herdr owns normal mouse
# selection and sends copied text with OSC-52, so bridge that sequence to the
# client OS clipboard. The patcher asserts its pinned minified-code anchor;
# a future ttyd upgrade fails the image build instead of silently losing copy.
COPY container/patch-ttyd-index.cjs container/ttyd-clipboard-bridge.js /usr/local/share/ttyd/
RUN node /usr/local/share/ttyd/patch-ttyd-index.cjs \
      /usr/local/share/ttyd/index.html \
      /usr/local/share/ttyd/ttyd-clipboard-bridge.js && \
    grep -qF 'registerOscHandler(52' /usr/local/share/ttyd/index.html && \
    grep -qF 'data-may-clipboard-bridge' /usr/local/share/ttyd/index.html && \
    rm /usr/local/share/ttyd/patch-ttyd-index.cjs /usr/local/share/ttyd/ttyd-clipboard-bridge.js

# Install CLI agent tools (claude-code, codex, pi) used as worker agents. They use
# the configured model endpoint; keep versions pinned so image rebuilds do not
# silently change agent behavior.
ARG CLAUDE_CODE_VERSION=2.1.228
ARG CODEX_VERSION=0.147.0
ARG PI_CODING_AGENT_VERSION=0.84.1
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} @openai/codex@${CODEX_VERSION} @earendil-works/pi-coding-agent@${PI_CODING_AGENT_VERSION} \
    && test "$(claude --version | awk '{print $1}')" = "${CLAUDE_CODE_VERSION}" \
    && test "$(codex --version | awk '{print $2}')" = "${CODEX_VERSION}" \
    && test "$(pi --version)" = "${PI_CODING_AGENT_VERSION}" \
    && claude --help | grep -q -- '--output-format' \
    && claude --help | grep -q -- '--model' \
    && claude --help | grep -q -- '--resume' \
    && codex exec --help | grep -q -- '--output-last-message' \
    && codex exec resume --help | grep -q -- '--last' \
    && pi --help | grep -q -- '--provider' \
    && pi --help | grep -q -- '--model' \
    && pi --help | grep -q -- '--continue' \
    && pi --help | grep -q -- '--list-models' \
    && npm cache clean --force

# Copy compiled runtime tools from builder. The service runs from the standalone
# may-agent binary, but agent/operator commands and docs assume `bun` exists.
COPY --from=builder --chown=mayagent:mayagent /build/may-agent /usr/local/bin/may-agent
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
# Copy the default May Agent project UI for image-only runs. Local compose
# mounts /app from the host, so the host project tree is the source of truth.
COPY packages/webui/static/ /app/projects/platform/ui/

# Copy supervisord config
COPY container/supervisord.conf /etc/supervisord.conf
RUN mkdir -p /app/.state/runtime-logs && chown -R mayagent:mayagent /app/.state/runtime-logs

# Copy entrypoints and helpers
COPY container/entrypoint.sh container/start-chrome.sh container/setup-claude-config.sh container/setup-codex-config.sh container/setup-pi-config.sh container/setup-herdr-integrations.sh container/may-agent-supervisor-restart.sh /usr/local/bin/
COPY packages/terminal/bin/may-console.cjs /usr/local/bin/may-console
RUN chmod 755 /usr/local/bin/may-agent /usr/local/bin/entrypoint.sh /usr/local/bin/start-chrome.sh /usr/local/bin/setup-claude-config.sh /usr/local/bin/setup-codex-config.sh /usr/local/bin/setup-pi-config.sh /usr/local/bin/setup-herdr-integrations.sh /usr/local/bin/may-agent-supervisor-restart.sh /usr/local/bin/may-console && \
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
ENV PI_CODING_AGENT_DIR=/app/.state/.pi/agent
ENV PATH=/usr/local/bin:$PATH

# noVNC web interface
EXPOSE 6080

# Web UI dashboard
EXPOSE 8080

# ttyd + Herdr terminal
EXPOSE 7681

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
