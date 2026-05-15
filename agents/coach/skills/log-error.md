# Skill: Log Error (Structured JSONL)

**Purpose:** Mandate the structured JSONL error logging format when manually recording agent failures during coaching sessions.

**Related:** P109 Break the Lock, P110 Active Recall, `shared/knowledge/error-log-schema.md`

## When to Use

- After a coaching session reveals a repeating failure pattern
- After an evaluation flags a behavioral regression
- After a red-team drill exposes a vulnerability
- Any time you manually record an error to an agent's `ERROR_LOG.md`

## Format

Every entry in `agents/{agent}/ERROR_LOG.md` **MUST** be a single-line JSON object (JSONL). No free-text prose. No markdown tables. No scalar pass/fail.

```json
{"date":"YYYY-MM-DD","task_id":"s_XXXXX","error_code":"FM-X.Y","trigger":"The action that failed","critique":"Why it failed — the causal mechanism","correction":"What to do instead — the specific fix"}
```

### Field Requirements

| Field | Required | Purpose |
|-------|----------|---------|
| `date` | Yes | ISO date of the failure |
| `task_id` | Yes | Session ID where the failure occurred |
| `error_code` | Yes | MAST failure code (see `mast-taxonomy.md`) |
| `trigger` | Yes | The specific action/tool call that failed |
| `critique` | Yes | **Directional gradient** — explain the causal failure mechanism, not just "it failed" |
| `correction` | Yes | **Negative constraint** — specific instruction for next time |

## Anti-Patterns (Do NOT)

- ❌ `"status": "failed"` — scalar, no direction
- ❌ Free-text paragraph — not greppable
- ❌ `"reason": "Agent was bad"` — blame without actionable correction
- ❌ Missing `critique` or `correction` — these are the entire point

## Procedure

1. **Identify** the failure from evaluation data or coaching observation
2. **Classify** using MAST taxonomy (`error_code`)
3. **Diagnose** the root cause (`critique` — must answer "why did this happen?")
4. **Prescribe** the fix (`correction` — must answer "what should the agent do differently?")
5. **Append** as single-line JSONL:
   ```bash
   echo '{"date":"2026-03-14","task_id":"s_12345","error_code":"FM-2.6","trigger":"Used docker run","critique":"Docker socket not mounted; command fails silently in this environment","correction":"Use node script.js directly instead of Docker"}' >> agents/{agent}/ERROR_LOG.md
   ```
6. **Verify** the line is valid JSON: `tail -1 agents/{agent}/ERROR_LOG.md | jq .`

## Rationale

Per P109 (Break the Lock): Pure RL with scalar rewards causes information self-locking — agents stop exploring and can't improve. Directional critique (`critique` + `correction` fields) breaks this cycle by providing the specific gradient needed for behavioral correction. JSONL format enables P110 (Active Recall) — agents can `grep` their error log before repeating past mistakes.
