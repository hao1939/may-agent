# Skill: CLI-Assisted Coding

Use production agent CLIs (Claude Code, Gemini CLI, OpenAI Codex) as tools our agents can invoke via bash.

## Tool: `agents/tools/cli-invoke.sh`

```bash
# Invoke any CLI with structured JSON output
bash agents/tools/cli-invoke.sh <claude|gemini|codex> "<prompt>" [timeout_seconds]

# Returns JSON:
# {"cli":"gemini","exit_code":0,"output":"...response...","error":"","elapsed_ms":3200}
```

### Exit Codes
| Code | Meaning |
|------|---------|
| 0 | Success — `output` contains LLM response |
| 1 | CLI error — check `output` for details |
| 2 | CLI binary not found |
| 3 | Missing API key (fast-fail, 0ms) |
| 124 | Timeout |

## Prerequisites

1. CLIs installed at `/usr/bin/{claude,gemini,codex}` ✅ (all three present)
2. Environment variable for at least one:
   - `ANTHROPIC_API_KEY` → Claude Code
   - `GEMINI_API_KEY` → Gemini CLI
   - `OPENAI_API_KEY` → OpenAI Codex

## Agent Usage Pattern

```bash
# Try CLI, fall back to agent-only if unavailable
result=$(bash agents/tools/cli-invoke.sh gemini "write a Python fizzbuzz" 30)
exit_code=$?

case $exit_code in
  0)   response=$(echo "$result" | jq -r '.output') ;;
  3)   echo "No API key — solve directly" ;;
  124) echo "Timeout — solve directly" ;;
  *)   echo "CLI error — solve directly" ;;
esac
```

## Multi-Model Pattern

```bash
# Fork 3 CLIs in parallel for consensus
for cli in claude gemini codex; do
  bash agents/tools/cli-invoke.sh "$cli" "$PROMPT" 30 > "/tmp/$cli-result.json" &
done
wait

# Compare outputs
for cli in claude gemini codex; do
  jq -r '.output' "/tmp/$cli-result.json" 2>/dev/null
done
```

## Best Practices

1. **Always use the wrapper** — don't call CLIs directly; the tool handles key validation, timeout, and JSON output
2. **Set short timeouts** — 10-30s; Claude hangs silently on bad keys
3. **Check exit code 3 first** — fast-fail on missing keys before attempting network calls
4. **Parse JSON output** — use `jq -r '.output'` to extract LLM response
5. **Fall back gracefully** — if CLI fails, agent solves the task directly

## CLI-Specific Notes

| CLI | Version | Auth Error Behavior | Speed |
|-----|---------|-------------------|-------|
| Claude Code | v2.1.117 | Hangs silently (needs timeout) | Slowest |
| Gemini CLI | latest | Fast fail, HTTP 400, exit 1 | Fastest error |
| OpenAI Codex | v0.122.0 | 5 retries, HTTP 401, ~15s | Most verbose |

## Current Status

- ✅ Tool implemented: `agents/tools/cli-invoke.sh`
- ✅ All three CLIs installed and invocable
- ✅ JSON output, exit codes, timeout safety all tested
- ❌ **No API keys configured** — set env vars to enable
