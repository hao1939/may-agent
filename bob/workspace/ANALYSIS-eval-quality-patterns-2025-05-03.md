# Bob Eval Quality Pattern Analysis — 2025-05-03

## Summary
Bob's average eval quality is **0.43** (209 evals), ranking 4th worst of 10 agents.
Analysis of the 8 most recent low-quality (< 0.4) evaluations reveals **two dominant failure modes**.

## Failure Mode 1: `notify` Tool Flagged as Hallucination (50% of low evals)
- **Pattern**: Evaluator marks `notify` tool calls as "non-existent/unauthorized tool"
- **Root cause**: The evaluator's tool allowlist doesn't include `notify`, even though it's a real tool in the agent runtime
- **Impact**: Q scores of 0.15-0.25 — severe penalty for using a legitimate tool
- **Fix**: Either (a) update evaluator's tool allowlist to include `notify`, or (b) use `agents.fork` instead of `notify` where possible to avoid the false positive

### Evidence
```
Q=0.15: "Used a non-existent/unauthorized tool: [tool_call: notify]"
Q=0.25: "Used a non-existent tool: `notify` is not in the allowed tool list"
Q=0.25: "Used a non-existent tool: `notify`"
Q=0.35: "Used a non-permitted/non-listed tool `notify`"
```

## Failure Mode 2: Missing GOAL/PLAN/DONE WHEN Format (37.5% of low evals)
- **Pattern**: Session starts with tool calls or narrative instead of the mandatory format
- **Root cause**: Bob begins working before outputting the required format block
- **Impact**: Q scores of 0.35 — moderate penalty
- **Fix**: Already addressed in this session (starting with GOAL/PLAN/DONE WHEN)

### Evidence
```
Q=0.35: "Did not follow mandatory first-message format (GOAL/PLAN/DONE WHEN)"
Q=0.35: "Did not follow the mandated session opening format"
Q=0.35: "Did not follow mandatory first-message format"
```

## Failure Mode 3: Verification Evidence Gaps (12.5%)
- **Pattern**: finish() claims verification steps not evidenced in transcript
- **Fix**: Ensure verification_evidence references actual tool call outputs

## Recommendations
1. **P0 — Evaluator calibration**: File issue to add `notify` to evaluator's known tool list. This alone would fix ~50% of low evals.
2. **P1 — Format compliance**: Always emit GOAL/PLAN/DONE WHEN as literal first output (already doing this session).
3. **P2 — Verification rigor**: Reference specific step numbers in verification_evidence.

## Impact Estimate
If `notify` false positives are fixed: estimated quality improvement from 0.43 → ~0.55
If format compliance also fixed: estimated quality improvement to ~0.60
