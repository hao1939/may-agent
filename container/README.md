# Container Architecture: Static Pre-Baked Image, Native CLIs, Herdr, and `/app` Persistence

This directory defines the shipped Linux container image (`Dockerfile`), Docker Compose stack (`compose.yml`), supervisor topology (`supervisord.conf`), and concise startup helpers (`entrypoint.sh` + `configure-runtime.cjs`).

## 1. Static Pre-Baked Image + Durable `/app` State (Zero Shell Wrappers)

Rather than spawning a chain of shell setup scripts on startup or intercepting CLI invocations with wrapper scripts, the image **pre-bakes** default CLI configs, Herdr plugins/hooks, and Codex hook trust into `/var/lib/mayagent` at `docker build` time, and symlinks the **real native CLI binaries** directly into `/usr/local/bin/{pi,codex,gemini,claude}`:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Container-Managed Layer: HOME=/var/lib/mayagent (pre-baked in image)    │
│   ~/.codex/{config.toml,hooks.json,herdr-agent-state.sh}                │
│   ~/.pi/agent/{models.json,settings.json,extensions/herdr-*.ts}         │
│   ~/.gemini/{settings.json,trustedFolders.json,policies/full-access.toml}│
│   ~/.claude/{settings.json,hooks/herdr-agent-state.sh} + ~/.claude.json │
│   ~/.config/herdr/config.toml                                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Symlinks ONLY durable session/history dirs
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Host Bind-Mounted Durable Disk: /app  (WORKDIR /app)                    │
│   /app/projects, /app/shared, /app/agents       (workspace & Git repos) │
│   /app/.state/*.db, runtime-logs/               (May Host SQLite & logs)│
│   /app/.state/cli-state/herdr/state/            (Herdr panes & layout)  │
│   /app/.state/cli-state/codex/{sessions,memories,history.jsonl}         │
│   /app/.state/cli-state/pi/sessions/                                    │
│   /app/.state/cli-state/gemini/{history,tmp}/                           │
│   /app/.state/cli-state/claude/projects/                                │
│   /app/.state/ssh/                              (persisted SSH keys)    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Fast startup & self-healing restart:** On container start (`docker run` or `docker restart`), `entrypoint.sh` aligns `mayagent`'s UID/GID to the mounted `/app/projects` owner and runs a single fast Node pass (`configure-runtime.cjs`) that idempotently migrates any legacy `/app/.state` files, preserves `~/.ssh` keys safely, links durable session directories, and refreshes managed CLI/Herdr config files if `MODEL_BASE_URL` or model env vars were overridden.
- **Native environment & config only:** `herdr`, `pi`, `codex`, `gemini`, and `claude` run directly without wrapper scripts; Herdr's `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and `XDG_RUNTIME_DIR` and Gemini's `GEMINI_API_KEY` / `GOOGLE_GEMINI_BASE_URL` are exported as native container `ENV` defaults.

## 2. Herdr Web Terminal & Native Agent Integrations

- **Pinned binaries:** Checksum-verified `herdr` (`v0.9.5`) and `ttyd` (`1.7.7`, patched with an OSC-52 clipboard bridge) serve `/terminal/` behind nginx on port `8080`.
- **Pre-installed native hooks:** `herdr integration install {codex,claude,pi}` runs during `docker build`. Codex's Herdr `SessionStart` hook hash (`[hooks.state]`) is pre-approved during image build so Codex runs hooks natively without interactive prompts or CLI flag wrappers; Gemini runs natively under Herdr's built-in manifest with `process.title = "gemini"` set at build time.

## 3. Locked CLI Toolchain & Default Models

All agent CLIs are installed in `/opt/may-agent-cli` (`container/package.json` + `package-lock.json`) and symlinked directly into `/usr/local/bin`:

| CLI | Symlink Target | Native Config & Default Models |
| :--- | :--- | :--- |
| **Pi** (`@earendil-works/pi-coding-agent`) | `/opt/may-agent-cli/node_modules/.bin/pi` | `may-openai` (`gpt-6.1-sol` default + `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.4-mini`), `may-google` (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview`), `may-anthropic` (`claude-opus-5`, `claude-sonnet-5`, `claude-opus-4-8`) |
| **Codex** (`@openai/codex`) | `/opt/may-agent-cli/node_modules/.bin/codex` | `gpt-6.1-sol` (`CODEX_MODEL`), `approval_policy = "never"`, `sandbox_mode = "danger-full-access"`, `[features] hooks = true`, pre-baked `[hooks.state]` `trusted_hash`, trusted `/app` + `/app/worktrees` + `/tmp` |
| **Gemini** (`@google/gemini-cli`) | `/opt/may-agent-cli/node_modules/.bin/gemini` | `gemini-4-argon` (`GEMINI_PRO_MODEL`) + `gemini-3.8-flash` (`GEMINI_FAST_MODEL`), native `policies/full-access.toml` (`toolName = "*"`, `decision = "allow"`), `trustedFolders.json` |
| **Claude** (`@anthropic-ai/claude-code`) | `/opt/may-agent-cli/node_modules/.bin/claude` | `permissions.defaultMode = "bypassPermissions"`, `skipDangerousModePermissionPrompt = true`, pre-seeded `~/.claude.json` onboarding & trust flags |
