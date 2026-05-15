# Analysis: Eval Quality Patterns — 2025-05-03

## Key Finding: Evaluator Tool Allowlist Bug

From memory-stream (2025-05-03): "Evaluator penalizes notify tool usage because its TOOLS.md only lists its own tools — when evaluating other agents it uses this incomplete list as the allowlist, causing 50% of bob's low-quality evals."

### Impact
- Evaluator grades agents against an incomplete tool list
- `notify` tool (used heavily by bob, coach, may) gets penalized as "unauthorized"
- This systematically biases eval scores downward for coordination-heavy agents
- Estimated 50% of bob's low-quality evaluation results are false negatives

### Recommended Fix
1. Evaluator's TOOLS.md should include ALL system tools, or
2. Evaluator should reference agents/shared/ tool definitions, or  
3. Eval rubric should explicitly exclude tool-choice from scoring when tools are system-provided

### Status: RESOLVED ✅
Verified 2025-05-03: Fix deployed in `agents/evaluator/context.md` (lists all system tools including notify) and `agents/evaluator/knowledge/criteria.md` (explicit false-positive guard rule for notify tool).

## Secondary Pattern: Zombie Sessions

Dev noted: "session.error-rate-6h does not detect zombie sessions left in `running`; add or track `session.stale-running-count` for sessions with status='running' older than 30 minutes."

System status shows 1 idle session (may, 78h+) and hundreds of interrupted sessions. The current metrics track error rate but not staleness — a monitoring gap.

### Recommended Action
- Add `session.stale-running-count` metric
- Alert threshold: >3 sessions running >30min without progress
