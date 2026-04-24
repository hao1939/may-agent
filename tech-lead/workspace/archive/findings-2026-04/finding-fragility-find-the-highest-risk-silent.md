# Eval Pipeline Fragility Findings

## Highest Risk: parseTaskEvaluation() silently returns zeroes on malformed LLM output

**File**: `src/lib/evaluator.ts`, lines ~205-250 (`parseTaskEvaluation`)

**Problem**: When the evaluator LLM returns text that doesn't match the expected JSON format, `parseTaskEvaluation` silently returns `defaultResult` with all zeroes: `efficiency: 0, quality: 0, verdict: "needs_improvement", result_delivered: false`. These zeroes are then **persisted to the DB** via `upsertEvaluation()`.

There IS a retry mechanism (lines ~395-415) for `evaluateTask()` when zero agent scores are returned, but:
1. The retry only checks `Object.keys(parsed.agents).length > 0` — if the LLM returns a valid JSON block with agents but garbage scores (e.g., strings instead of numbers), the defaults (0) are silently accepted without retry.
2. `evaluateStandaloneSession()` (line ~800+) has **no retry at all**. If the evaluator returns malformed JSON, you get zeroes persisted permanently.
3. Once persisted with `evaluatedByHeuristic: false, skippedByJs: false`, `hasLLMEvaluation()` returns true, so the session is **never re-evaluated**. The bad scores are permanent.

**Severity**: HIGH — corrupts evaluation data silently, no logging of parse failures, no way to detect or recover.

## Secondary Findings

### 2. evaluation-sync.ts heuristic gives Q:1.0 to all "done" sessions by default
**File**: `agents/may/handlers/evaluation-sync.ts`, `computeEvaluation()` (line ~130+)

Non-error done sessions get `quality: 1.0` by default. The heuristic has no way to detect task failure when status is "done" — an agent can produce garbage output, call `finish(status: "success")`, and get a perfect quality score from the heuristic. Only the ~30% LLM sampling catches this.

### 3. No validation on `task` field — empty task strings flow through silently
**File**: `src/lib/evaluator.ts`, `evaluateStandaloneSession()` line ~830

`task || "heartbeat"` fallback means sessions with empty/null task get labeled "heartbeat" in the eval prompt. The evaluator LLM then scores them as heartbeat sessions when they may be something else entirely. No logging.

### 4. extractUsage silently produces zeroes on unexpected message shapes
**File**: `src/lib/evaluator.ts`, `extractUsage()` (line ~80)

If `am.usage.cost` is an object with a non-`total` key (or any other unexpected shape), the `??` chain falls through to 0. Cost data is silently lost. The `?? 0` pattern on every field means any schema drift produces zeroes with no warning.

## Recommended Fix Priority
1. **Add logging** when `parseTaskEvaluation` returns zero agents or zero overall scores — at minimum a `ctx.log` warning
2. **Add retry to `evaluateStandaloneSession`** (match `evaluateTask` pattern)
3. **Mark failed parses** with a distinct verdict (e.g., "parse_error") so they can be re-evaluated later instead of being permanently locked as "LLM evaluated"
