# Skill: CLI Coding Agents

**Purpose:** Invoke production coding CLIs (Claude Code, Gemini CLI, OpenAI Codex) as tools from our agent system.

## Prerequisites

Set at least one API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."   # For Claude Code
export GOOGLE_API_KEY="..."              # For Gemini CLI
export OPENAI_API_KEY="sk-..."           # For OpenAI Codex
```

## Quick Start

```bash
# Claude Code (best structured output)
claude -p "Your coding task here" --output-format json --bare --dangerously-skip-permissions

# Gemini CLI
gemini -p "Your coding task here" -y

# OpenAI Codex
codex exec "Your coding task here" --full-auto
```

## Best Practices

### 1. Always Use Timeouts
```bash
timeout 120 claude -p "task" --output-format json 2>&1 || echo "TIMEOUT"
```

### 2. Parse JSON Output (Claude)
```bash
result=$(claude -p "task" --output-format json --bare 2>&1)
code=$(echo "$result" | jq -r '.result')
cost=$(echo "$result" | jq -r '.cost_usd')
```

### 3. Fallback Pattern
```bash
result=$(timeout 60 claude -p "$task" --output-format json --bare 2>&1) || true
if ! echo "$result" | jq -e '.result' >/dev/null 2>&1; then
  echo "CLI failed — handle task natively"
fi
```

### 4. Budget Control (Claude)
```bash
claude -p "task" --max-budget-usd 0.10 --output-format json
```

### 5. Multi-Model Consensus
```bash
# Run in parallel, compare outputs
claude -p "$task" --output-format json > /tmp/claude.json 2>&1 &
gemini -p "$task" > /tmp/gemini.txt 2>&1 &
codex exec "$task" > /tmp/codex.txt 2>&1 &
wait
```

### 6. Restrict Tool Access
```bash
# Claude: only allow read and bash
claude -p "task" --allowedTools "Read Bash(grep *)"

# Gemini: plan mode (read-only)
gemini -p "task" --approval-mode plan
```

## When to Use

| Scenario | Recommended |
|----------|------------|
| Simple code generation | ❌ Use agent natively |
| Multi-model review | ✅ Run 2-3 CLIs in parallel |
| Specialized model for subtask | ✅ Pick best model per task |
| Parallel independent work items | ✅ Fork CLI agents |
| Interactive debugging | ❌ CLIs lack conversation context |

## Reference

- Research: `.state/cli-research.md`
- Install log: `.state/cli-install-log.md`
- Integration tests: `.state/cli-integration-test.md`
- Evaluation: `.state/cli-evaluation.md`
