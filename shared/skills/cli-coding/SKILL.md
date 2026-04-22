# Skill: CLI-Assisted Coding

Use production agent CLIs (Claude Code, Gemini CLI, OpenAI Codex) as tools our agents can invoke via bash.

## Quick Start

```bash
# Claude Code (needs ANTHROPIC_API_KEY)
timeout 30 claude --bare -p "your prompt" --dangerously-skip-permissions 2>&1

# Gemini CLI (needs GEMINI_API_KEY)
timeout 30 gemini -p "your prompt" -y 2>&1

# OpenAI Codex (needs OPENAI_API_KEY)
timeout 30 codex exec --skip-git-repo-check "your prompt" 2>&1
```

## Prerequisites

1. CLIs installed (all three at `/usr/bin/{claude,gemini,codex}`)
2. At least one API key set as environment variable

## Wrapper Script

```bash
#!/bin/bash
# cli-invoke.sh <cli> <prompt> [timeout]
CLI="${1:?}" PROMPT="${2:?}" TIMEOUT="${3:-30}"
case "$CLI" in
  claude) timeout "$TIMEOUT" claude --bare -p "$PROMPT" --dangerously-skip-permissions 2>&1 ;;
  gemini) timeout "$TIMEOUT" gemini -p "$PROMPT" -y 2>&1 ;;
  codex)  timeout "$TIMEOUT" codex exec --skip-git-repo-check "$PROMPT" 2>&1 ;;
esac
EXIT=$?; [ $EXIT -eq 124 ] && echo "TIMEOUT" >&2; exit $EXIT
```

## Best Practices

1. **Always use timeout** — CLIs may hang on auth failures (Claude silently hangs)
2. **Use non-interactive flags** — `-p` for Claude/Gemini, `exec` for Codex
3. **Use bare/minimal mode** — `--bare` for Claude skips hooks and LSP for faster startup
4. **Auto-approve in sandboxes** — `--dangerously-skip-permissions` (Claude), `-y` (Gemini)
5. **Parse exit codes** — 0=success, 41=Gemini auth error, 124=timeout, 1=general error
6. **Capture stderr** — Codex puts session metadata and errors on stderr

## When to Use CLIs vs Agent-Only

| Use Case | Recommendation |
|----------|---------------|
| Simple code generation | Agent-only (faster, no overhead) |
| Multi-model comparison | CLI-assisted (fork 3 CLIs in parallel) |
| Specialized tasks | CLI-assisted (use best model per task) |
| Code review | CLI-assisted (multiple perspectives) |
| Quick answers | Agent-only (zero latency) |

## Error Handling

```bash
output=$(timeout 30 claude --bare -p "$PROMPT" 2>&1)
exit_code=$?
case $exit_code in
  0)   echo "Success: $output" ;;
  124) echo "Timeout — check API key" ;;
  41)  echo "Auth error (Gemini)" ;;
  *)   echo "Error ($exit_code): $output" ;;
esac
```

## Current Status

- ✅ All three CLIs installed and invocable
- ❌ No API keys configured — set `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`
- 📋 See `.state/cli-research.md` for detailed flag documentation
