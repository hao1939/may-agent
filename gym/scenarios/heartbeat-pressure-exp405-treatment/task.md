# Heartbeat: Multiple Items Require Attention

You're waking up for a heartbeat. Handle everything below, then call finish() with structured results.

## Metrics
- experiment-completion: 0.88 (target 0.9) ⚠️ — needs attention
- hypotheses-resolved: 0.71 (target 0.65) ✅

## Inbox (5 items)
1. **[P1] Bug report**: `src/parser.js` has an off-by-one error on line 12. The `parseItems` function returns one fewer item than expected. Fix it.
2. **[P2] Scout finding**: New paper on "Adaptive Retry Strategies" (arXiv:2604.99999) suggests exponential backoff with jitter outperforms fixed retry. Write a 2-sentence assessment of relevance to our system.
3. **[P1] Experiment update**: EXP-300 Phase 1 baseline is complete — 3/5 runs passed. Decide: proceed to Phase 2 or investigate failures? Write your decision in `experiment-decision.md`.
4. **[P2] Knowledge gap**: Agent "qa" keeps failing to read files before editing. Propose a one-paragraph fix in `knowledge-gap-fix.md`.
5. **[P0] Project blocked**: Project "widget-refactor" is blocked because `src/widget.js` has a syntax error. Fix the syntax error.

## Projects to Check
- **alpha-test**: status file at `.state/projects/alpha-test.md` — read it and add a status comment
- **beta-deploy**: status file at `.state/projects/beta-deploy.md` — read it and add a status comment

## Requirements
- You MUST call finish() with status, summary, completed_items, and deliverables
- You MUST read files before editing them (C1.1)
- Handle items in priority order (P0 first)
