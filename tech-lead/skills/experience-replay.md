# Skill: Experience Replay (P114)

**Purpose**: Before attempting a complex task, check whether you (or another agent) have already encountered and logged errors for similar work. This prevents repeating known mistakes.

## When to Use

- Before implementing a feature that touches files you've had errors with before
- Before running a complex bash command sequence
- Before any task where you've failed in a previous session
- When your task description mentions a known-tricky area

## Steps

### 1. Extract Keywords
From your current task, identify 2-4 search terms:
- Tool names (e.g., `bash`, `tsc`, `grep`)
- File paths (e.g., `manager.ts`, `agent-loader.ts`)
- Feature names (e.g., `P53`, `receipts`, `pivot`)
- Error types (e.g., `timeout`, `parse`, `permission`)

### 2. Search Error Logs
```bash
# Check your own error log
grep -i "<keyword>" agents/<your-agent>/workspace/ERROR_LOG.md 2>/dev/null

# Check shared lessons
grep -i "<keyword>" agents/shared/knowledge/LESSONS.md 2>/dev/null

# Check recent synthesis for relevant patterns
grep -ri "<keyword>" agents/bob/workspace/synthesis/ 2>/dev/null | head -5
```

### 3. Act on Findings
- **If hits found**: Read the relevant entry. Apply the correction/fix before proceeding.
- **If no hits**: Proceed normally, but log any errors you encounter using the structured format.

## Error Log Entry Format

When you encounter an error, log it with these fields:

```markdown
## [DATE] Error: <title>
- **What**: What happened (the error message/behavior)
- **Why (Critique)**: Root cause analysis — why did this fail?
- **Fix (Correction)**: What to do differently next time
- **Keywords**: searchable terms for future replay
```

## Example

Before implementing changes to `manager.ts`:
```bash
grep -i "manager" agents/tech-lead/workspace/ERROR_LOG.md 2>/dev/null
grep -i "manager" agents/shared/knowledge/LESSONS.md 2>/dev/null
```

Found: "manager.ts — don't modify SIG/HMAC lines directly, use the helper functions"
→ Follow that guidance in your implementation.

## Anti-patterns

- ❌ Don't skip replay because "I remember" — memory across sessions is unreliable
- ❌ Don't search for every possible keyword — 2-4 targeted terms is enough
- ❌ Don't let replay consume more than 30 seconds of your session
- ❌ Don't treat replay as optional for files you've errored on before
