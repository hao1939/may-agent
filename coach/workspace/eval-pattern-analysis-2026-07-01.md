# Evaluation Pattern Analysis — 2026-07-01

## Data Source
4 most recent evaluations in `.state/evaluations/`

## Dominant Failure: Empty-Response Loops (3/4 evals)

| Session | Agent | Quality | Key Issue |
|---------|-------|---------|-----------|
| s_1777483248236_446 | optimizer | 0.1 | 0 files, looping, WRITE-FIRST ignored |
| s_1777483248263_447 | optimizer | 0.2 | Interrupted, claims without evidence |
| s_1777483248275_448 | coach | 0.0 | 28+ empty iterations, 0 tool calls |
| s_1777471451597_3 | optimizer | 0.2 | Abrupt end before executing plan |

## Pattern Summary
1. **Empty responses** — agent returns no tool calls at all (not even reads)
2. **Escalation backfires** — retry prompts with stronger constraints make it worse
3. **Phantom claims** — when agent does respond, it claims completion without evidence
4. **Cross-agent** — affects both optimizer and coach, not agent-specific

## Root Cause Hypothesis
The retry escalation mechanism (adding WRITE-FIRST, EDIT-FIRST constraints) overwhelms rather than helps. The accumulating failure context may confuse the model.

## Recommended Action
→ EXP-511: Test "clean slate" retry vs escalating retry
