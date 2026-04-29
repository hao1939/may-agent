# CLI Coding Agents Skill

Use production AI coding CLIs (Claude Code, Gemini CLI, OpenAI Codex) as subprocess tools.

## Installed CLIs

| CLI | Path | Version | Auth Status |
|-----|------|---------|-------------|
| Claude Code | `/usr/bin/claude` | 2.1.117 | OAuth token (routes through litellm proxy) |
| Gemini CLI | `/usr/bin/gemini` | 0.38.2 | Needs `GEMINI_API_KEY` |
| OpenAI Codex | `/usr/bin/codex` | 0.122.0 | Needs `OPENAI_API_KEY` |

## Quick Start

### Claude Code (recommended — already authenticated)
```bash
# Requires litellm proxy at http://litellm:4000 to be running
claude -p "your prompt" --max-turns 1 --output-format json
```

### Gemini CLI
```bash
GEMINI_API_KEY=<key> gemini -p "your prompt"
```

### OpenAI Codex
```bash
OPENAI_API_KEY=<key> codex exec "your prompt" --skip-git-repo-check
```

## Wrapper Script

Use `invoke-claude.sh` for safe invocation with pre-flight checks:
```bash
./agents/shared/skills/cli-coding/invoke-claude.sh "prompt" [max_turns] [timeout_secs]
```

Fails fast with exit code 2 if the litellm proxy is unreachable (instead of hanging).

## Current Blocker

Claude CLI is configured to proxy through `http://litellm:4000` (set in `/app/.state/.claude/settings.json`).
This proxy is not currently running, so all `claude -p` calls hang indefinitely.

**To unblock**: Ensure the litellm container is running and reachable at `http://litellm:4000`.

## Architecture

```
Agent → invoke-claude.sh → pre-flight check → claude -p → litellm:4000 → Anthropic API
```
