ARG NODE_IMAGE=node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
ARG DEBIAN_IMAGE=debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171

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
COPY .bun-version /tmp/may-bun-version
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v$(cat /tmp/may-bun-version)" && \
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
COPY scripts/build-runtime-binary.ts scripts/build-runtime-binary.ts
COPY tsconfig.json ./

ARG WORKSPACE_PACKAGE_DIRS="packages/control packages/sdk packages/terminal packages/webui"
RUN actual="$(find packages -mindepth 2 -maxdepth 2 -name package.json -printf '%h\n' | sort | xargs)" && \
    test "$actual" = "$WORKSPACE_PACKAGE_DIRS" || \
    (printf 'Workspace package list drifted.\nExpected: %s\nActual:   %s\nUpdate Dockerfile workspace manifest COPY lines and WORKSPACE_PACKAGE_DIRS.\n' "$WORKSPACE_PACKAGE_DIRS" "$actual" >&2; exit 1)

# Compile through the same entrypoint used by correlated runtime deploys. This
# keeps image builds and live deploys on one artifact contract.
ARG MAY_AGENT_BUILD_COMMIT=unknown
RUN MAY_AGENT_BUILD_COMMIT="${MAY_AGENT_BUILD_COMMIT}" bun scripts/build-runtime-binary.ts --outfile /build/may-agent

# ── Runtime stage: minimal image with Chrome + GUI + Agent CLIs ───────────
FROM ${DEBIAN_IMAGE}

LABEL org.opencontainers.image.title="may-agent" \
      org.opencontainers.image.description="May Host runtime with Herdr web terminal and Pi/Codex/Gemini/Claude CLIs"

# Consolidate OS, Python (required by Herdr Codex/Gemini/Claude hooks), Chrome,
# and Xvfb/noVNC installation in minimal cached layers with clean apt cleanup.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      dbus-x11 \
      fluxbox \
      fonts-noto-cjk \
      git \
      gnupg2 \
      jq \
      nginx-light \
      novnc \
      openssh-client \
      procps \
      python3 \
      ripgrep \
      socat \
      supervisor \
      tini \
      unzip \
      websockify \
      x11vnc \
      xvfb; \
    if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
      curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list && \
      apt-get update && \
      apt-get install -y --no-install-recommends google-chrome-stable; \
    else \
      apt-get install -y --no-install-recommends chromium; \
    fi; \
    apt-get clean -y; \
    rm -rf /var/lib/apt/lists/* /tmp/*

# Keep both web-terminal binaries pinned and checksum-verified so rebuilding
# the image cannot silently change the terminal stack.
ARG HERDR_VERSION=0.9.5
ARG HERDR_AMD64_SHA256=14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d
ARG HERDR_ARM64_SHA256=17d7536f2da50859523680ef279dffcac8e4a235f4e46fe8da6c2ec44141897c
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
    herdr --default-config | grep -q '^# resume_agents_on_restore = true$'; \
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
    wait "${terminal_ttyd_pid}" || true; \
    rm -f /tmp/ttyd-index.log

WORKDIR /app

# Separate ephemeral container-managed HOME (/var/lib/mayagent) from mounted
# durable /app/.state so container restarts heal config drift while preserving
# symlinked session histories and SQLite databases on /app/.state.
RUN useradd -u 1000 -m -d /var/lib/mayagent -s /bin/bash mayagent 2>/dev/null || true && \
    mkdir -p /var/lib/mayagent && \
    chown -R mayagent:mayagent /var/lib/mayagent && \
    git config --system --replace-all safe.directory '*'

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

# Install the locked CLI agent tools outside /app so an installation bind mount
# cannot hide them. Symlink the native CLI binaries directly into /usr/local/bin
# (no shell wrappers).
COPY container/package.json container/package-lock.json /opt/may-agent-cli/
RUN set -eu; \
    npm ci --prefix /opt/may-agent-cli --omit=dev --no-audit --no-fund; \
    sed -i '1a process.title = "gemini";' /opt/may-agent-cli/node_modules/@google/gemini-cli/bundle/gemini.js; \
    ln -s /opt/may-agent-cli/node_modules/.bin/claude /usr/local/bin/claude; \
    ln -s /opt/may-agent-cli/node_modules/.bin/codex /usr/local/bin/codex; \
    ln -s /opt/may-agent-cli/node_modules/.bin/pi /usr/local/bin/pi; \
    ln -s /opt/may-agent-cli/node_modules/.bin/gemini /usr/local/bin/gemini; \
    claude_version="$(node -p "require('/opt/may-agent-cli/package.json').dependencies['@anthropic-ai/claude-code']")"; \
    codex_version="$(node -p "require('/opt/may-agent-cli/package.json').dependencies['@openai/codex']")"; \
    pi_version="$(node -p "require('/opt/may-agent-cli/package.json').dependencies['@earendil-works/pi-coding-agent']")"; \
    gemini_version="$(node -p "require('/opt/may-agent-cli/package.json').dependencies['@google/gemini-cli']")"; \
    test -x "$(command -v claude)"; \
    test "$(claude --version | awk '{print $1}')" = "$claude_version"; \
    test "$(codex --version | awk '{print $2}')" = "$codex_version"; \
    test "$(pi --version)" = "$pi_version"; \
    test "$(gemini --version)" = "$gemini_version"; \
    claude --help > /tmp/claude.help; \
    codex exec --help > /tmp/codex-exec.help; \
    codex exec resume --help > /tmp/codex-resume.help; \
    pi --help > /tmp/pi.help; \
    gemini --help > /tmp/gemini.help; \
    grep -q -- '--output-format' /tmp/claude.help; \
    grep -q -- '--model' /tmp/claude.help; \
    grep -q -- '--resume' /tmp/claude.help; \
    grep -q -- '--output-last-message' /tmp/codex-exec.help; \
    grep -q -- '--last' /tmp/codex-resume.help; \
    grep -q -- '--provider' /tmp/pi.help; \
    grep -q -- '--model' /tmp/pi.help; \
    grep -q -- '--continue' /tmp/pi.help; \
    grep -q -- '--list-models' /tmp/pi.help; \
    grep -q -- '--approval-mode' /tmp/gemini.help; \
    npm cache clean --force; \
    rm -rf /root/.npm /root/.cache /tmp/*

# Pre-bake default CLI configs, Herdr integrations, and Codex hook trust into
# /var/lib/mayagent at image build time so the container is ready out of the box.
COPY container/configure-runtime.cjs /usr/local/bin/configure-runtime.cjs
RUN set -eu; \
    chmod 755 /usr/local/bin/configure-runtime.cjs; \
    HOME=/var/lib/mayagent MAY_SKIP_STATE_LINKS=1 /usr/local/bin/node /usr/local/bin/configure-runtime.cjs --bake-image; \
    HOME=/var/lib/mayagent MAY_SKIP_STATE_LINKS=1 /usr/local/bin/node /usr/local/bin/configure-runtime.cjs; \
    chown -R mayagent:mayagent /var/lib/mayagent

# Copy supervisord & nginx configs and container runtime helper scripts before
# the fast-changing compiled may-agent binary.
COPY container/supervisord.conf /etc/supervisord.conf
COPY container/may-agent-nginx.conf /etc/may-agent-nginx.conf
RUN nginx -t -c /etc/may-agent-nginx.conf && \
    mkdir -p /app/.state/runtime-logs && \
    chown -R mayagent:mayagent /app/.state/runtime-logs

COPY container/entrypoint.sh container/start-chrome.sh container/may-agent-supervisor-restart.sh /usr/local/bin/
COPY packages/terminal/bin/may-console.cjs /usr/local/bin/may-console

# Copy compiled runtime tools from builder last for optimal Docker layer caching.
COPY --from=builder --chown=mayagent:mayagent /build/may-agent /usr/local/bin/may-agent
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY packages/webui/static/ /app/projects/platform/ui/

RUN chmod 755 /usr/local/bin/may-agent /usr/local/bin/entrypoint.sh /usr/local/bin/start-chrome.sh /usr/local/bin/configure-runtime.cjs /usr/local/bin/may-agent-supervisor-restart.sh /usr/local/bin/may-console && \
    ln -sf /usr/local/bin/may-agent-supervisor-restart.sh /usr/local/bin/may-agent-supervisor-restart

# Virtual display
ENV DISPLAY=:99

# Container-managed HOME (/var/lib/mayagent) holds static baked CLI configs,
# while durable sessions and Herdr state live under /app/.state.
ENV HOME=/var/lib/mayagent
ENV SHELL=/bin/bash
ENV TERM=xterm-256color

ENV NODE_ENV=production
ENV PROJECT_ROOT=/app
ENV AGENTS_ROOT=/app/agents
ENV SHARED_ROOT=/app/shared
ENV PROJECTS_ROOT=/app/projects
ENV STATE_DIR=/app/.state
ENV PI_CODING_AGENT_DIR=/var/lib/mayagent/.pi/agent
ENV XDG_CONFIG_HOME=/var/lib/mayagent/.config
ENV XDG_STATE_HOME=/app/.state/cli-state/herdr/state
ENV XDG_RUNTIME_DIR=/tmp/may-herdr-runtime
ENV MODEL_BASE_URL=http://host.docker.internal:4000
ENV MODEL_API_KEY=not-needed
ENV GEMINI_API_KEY=not-needed
ENV GOOGLE_GEMINI_BASE_URL=http://host.docker.internal:4000
ENV PATH=/usr/local/bin:$PATH

# noVNC web interface
EXPOSE 6080

# Web UI dashboard & Herdr web terminal (/terminal/)
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
