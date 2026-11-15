# Container Architecture: Herdr, Agent CLIs, Model Routing, and `/app` Persistence

This directory defines the shipped Linux container image (`Dockerfile`), Docker Compose stack (`compose.yml`), supervisor topology (`supervisord.conf`), and startup configuration helpers (`entrypoint.sh`, `setup-*.sh`, `may-herdr.sh`, `gemini-wrapper.sh`).

## 1. Ephemeral Managed Config vs. Durable Mounted `/app` State

To guarantee **zero data loss across container restarts/rebuilds** while ensuring **accidental user edits or stale dotfiles never break CLI configs, model endpoints, or Herdr hooks**, the container separates `$HOME` from the bind-mounted `/app` workspace:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Ephemeral Container Layer: HOME=/var/lib/mayagent (rebuilt every start) │
│   ~/.codex/{config.toml,hooks.json,herdr-agent-state.sh}                │
│   ~/.pi/agent/{models.json,settings.json,extensions/herdr-*.ts}         │
│   ~/.gemini/{settings.json,trusted_hooks.json,policies/*,hooks/*}       │
│   ~/.claude/{settings.json,hooks/herdr-agent-state.sh}                  │
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

- **Self-healing configuration:** Restarting the container regenerates `config.toml`, `models.json`, `settings.json`, `full-access.toml`, and Herdr hooks from image scripts and environment variables.
- **Optional additive customization:** Operators can place optional extra Pi provider definitions in `/app/.state/cli-config/pi-models.local.json`; managed providers (`may-openai`, `may-google`, `may-anthropic`) always remain authoritative.
- **Mounted `/app` ownership alignment:** `setup-runtime-user.sh` aligns the container's `mayagent` UID/GID to the mounted `/app/projects` owner at startup (without recursively `chown`ing large project trees) and sets system-wide `git config --system safe.directory '*'` so Git worktrees never fail with dubious-ownership errors.

## 2. Herdr Web Terminal & Agent Integrations (`pi`, `codex`, `gemini`, `claude`)

- **Pinned binaries:** Checksum-verified `herdr` (`v0.9.5`) and `ttyd` (`1.7.7`, patched with an OSC-52 clipboard bridge) serve `/terminal/` behind nginx on port `8080`.
- **Runtime socket isolation:** `may-herdr` places `XDG_STATE_HOME` on durable `/app/.state/cli-state/herdr/state`, `XDG_CONFIG_HOME` on `/var/lib/mayagent/.config` (`resume_agents_on_restore = true`), and `XDG_RUNTIME_DIR` on local `/tmp/may-herdr-runtime` (avoiding Unix-socket issues on networked/bind mounts).
- **Hook & plugin installation (`setup-herdr-integrations.sh`):**
  - **Pi:** `herdr integration install pi` installs `herdr-agent-state.ts` into `$PI_CODING_AGENT_DIR/extensions/`.
  - **Codex:** `herdr integration install codex` installs `herdr-agent-state.sh` and `hooks.json`; `setup-codex-config.sh` enables `[features] hooks = true` and `python3` is shipped in the runtime image so the hook executes cleanly.
  - **Gemini:** Installs `~/.gemini/hooks/herdr-agent-state.sh`, registers `SessionStart`, `BeforeAgent`, `AfterAgent`, `Notification`, and `SessionEnd` hooks in `~/.gemini/settings.json`, and pre-trusts every hook key in `~/.gemini/trusted_hooks.json` so Gemini reports both `pane.report_agent_session` (`resume_argv: ["gemini", "--resume", session_id]`) and live `idle`/`working`/`blocked` lifecycle state (`pane.report_agent`) to Herdr.
  - **Claude:** `herdr integration install claude` installs `~/.claude/hooks/herdr-agent-state.sh`.

## 3. Locked CLI Toolchain & Default Models

All agent CLIs are installed outside `/app` in `/opt/may-agent-cli` (`container/package.json` + `package-lock.json`) so bind-mounting `/app` never shadows them:

| CLI | Binary Path | Default Model / Provider Routing |
| :--- | :--- | :--- |
| **Pi** (`@earendil-works/pi-coding-agent`) | `/usr/local/bin/pi` | `may-openai` (`gpt-6.1-sol` default + `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.4-mini`), `may-google` (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview`), `may-anthropic` (`claude-opus-5`, `claude-sonnet-5`, `claude-opus-4-8`) |
| **Codex** (`@openai/codex`) | `/usr/local/bin/codex` (wrapper -> `codex-cli`) | `gpt-6.1-sol` (`CODEX_MODEL`), `wire_api = "responses"`, `approval_policy = "never"`, `sandbox_mode = "danger-full-access"`, `--dangerously-bypass-hook-trust`, pre-trusted `/app` + `/app/worktrees` + `/tmp` |
| **Gemini** (`@google/gemini-cli`) | `/usr/local/bin/gemini` (wrapper -> `gemini-cli`) | `gemini-4-argon` (`GEMINI_PRO_MODEL`) + `gemini-3.8-flash` (`GEMINI_FAST_MODEL`), `defaultApprovalMode = "auto_edit"` + `--yolo` wrapper, `full-access.toml` policy, pre-seeded `trustedFolders.json` + `trusted_hooks.json` |
| **Claude** (`@anthropic-ai/claude-code`) | `/usr/local/bin/claude` | `bypassPermissions`, `skipDangerousModePermissionPrompt = true`, pre-seeded `~/.claude.json` (`hasCompletedOnboarding`, `bypassPermissionsModeAccepted`, `hasTrustDialogAccepted`, `hasTrustDialogHooksAccepted`) |

## 4. Docker Image Best Practices

- **Multi-stage build & layer ordering:** Compiles the standalone `may-agent` binary in `node:24-bookworm-slim` (`builder`), then layers OS/Chrome/Python/tini -> pinned `herdr`/`ttyd` -> `/opt/may-agent-cli` (`npm ci --omit=dev`) -> container scripts -> `may-agent` binary last so source edits rebuild in seconds.
- **PID 1 reaping & graceful shutdown:** Runs under `/usr/bin/tini -- /usr/local/bin/entrypoint.sh` (`init: true`, `stop_grace_period: 20s` in `compose.yml`) so `supervisord` cleanly flushes Herdr panes and SQLite WAL checkpoints on `docker stop` / `recreate`.
