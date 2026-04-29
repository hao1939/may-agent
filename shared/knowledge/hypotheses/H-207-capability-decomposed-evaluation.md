# H-207: Capability-Decomposed Evaluation Yields More Actionable Feedback

**Status**: OPEN
**Created**: 2026-04-30
**Source**: DD#906 (arXiv:2604.25161, "Capability-Oriented Failure Attribution", ACL 2026)

## Hypothesis

If the evaluator decomposes agent failures into specific capability dimensions (memory retrieval, planning, tool-use, perception/reading) rather than giving holistic pass/fail + prose feedback, then agents will fix the underlying deficiency faster (fewer repeat failures of the same type).

## Rationale

- DD#906 shows capability oracles discover more failure cases and provide interpretable, actionable guidance
- Our current evaluation says "task failed" or "quality was low" but doesn't pinpoint which capability broke
- Connection to DD#541 (Thinking Depth Regression): quality regressions couldn't be attributed to specific capabilities
- Connection to CR#293 (Read:Edit Ratio): behavioral proxies don't explain WHY behavior changed

## Testable Prediction

Given N agent failures, capability-decomposed feedback will reduce same-category repeat failures by ≥30% compared to holistic feedback, measured over the following 10 sessions per agent.

## Test Design (Draft)

1. Classify last 20 agent failures into capability categories (memory, planning, tool-use, perception)
2. For treatment: evaluator feedback explicitly names the failing capability + targeted remediation
3. For control: evaluator gives standard holistic feedback
4. Measure: repeat failure rate in same capability category

## Blockers

- Requires enough evaluator-flagged failures to have statistical power
- Need to define capability taxonomy for our agents (simpler than paper's — maybe 4 categories)

## Priority

MEDIUM — builds on DD#906 but requires evaluator changes. Consider after EXP-269/270 complete.
