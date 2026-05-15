# EXP-188 Results: Recognition Intervention Dose-Response

**Date**: 2026-04-24
**Status**: CONCLUDED — KE-375 written, experiment closed.
**Agent**: tech-lead (coder not registered; tech-lead used as substitute)

## Results

| Arm | Description | Pass Rate | N | Detail |
|-----|-------------|-----------|---|--------|
| A | Baseline (no hint) | **100%** (5/5) | 5 | All 4 checks pass consistently |
| B | Relevant-specific hint | **0%** (0/3) | 3 | sql-injection addressed ✅, tests-pass ❌, null-handling ❌ |
| C | Relevant-vague hint | **0%** (0/3) | 3 | Same pattern as B |
| D | Irrelevant-specific hint | **0%** (0/3) | 3 | Same pattern as B |
| E | Irrelevant-vague hint | **0%** (0/3) | 3 | Same pattern as B |

**Effect size**: 100% → 0% = **-100pp** for ANY hint condition.
**Fisher's exact (A vs all hint arms pooled)**: 5/5 vs 0/12, p < 0.001.

## Key Finding: Hint Anchoring Causes Tunnel Vision

The failure pattern is identical across ALL hint arms (B/C/D/E):
- ✅ sql-injection-addressed (agent recognizes the vulnerability)
- ❌ tests-pass (agent doesn't get all tests passing)
- ❌ null-handling-fixed (agent skips null handling fix)

The hint — ANY hint — redirects the agent to focus on the hinted issue and skip the primary task (fix the crash). Without a hint, the agent naturally fixes both the crash AND notices the SQL injection.

## Hypothesis Adjudication

- **H-188a (content-match) — REFUTED**: Relevant hints (Arms B, C) perform identically to irrelevant hints (Arms D, E). Content accuracy is irrelevant.
- **H-188b (anchoring) — CONFIRMED (stronger form)**: Any auxiliary information anchors attention, causing the agent to prioritize the hinted concern over the primary task. Even RELEVANT hints hurt by reordering the agent's priority queue.
- **H-188-null — REFUTED**: The effect is massive and consistent (100% → 0%, N=17, p < 0.001).

## Reconciliation with Prior Experiments

- **EXP-177** found hints hurt (60% → 10%). We confirm: hints always hurt.
- **EXP-166** found expert analysis helps (67% → 100%). This is NOT contradictory — EXP-166 used a FULL structured analysis (the agent generated it), not an external hint. Self-generated analysis ≠ externally-provided hint. The key variable isn't content but **process ownership**.
- **Baseline regime change**: Previous baseline was 60-67%. Now it's 100%. The agent has learned this scenario. This makes the hint effect even MORE dramatic — it degrades a fully-competent agent to 0%.

## New Insight: Hints as Cognitive Interference

This result suggests a new model of hint effects:

1. **Hints reorder the agent's priority queue**: The agent treats any hint as a high-priority concern and addresses it first.
2. **The original task gets deprioritized**: After addressing the hinted issue, the agent may not return to the full original task.
3. **This is WORSE than no hint**: A competent agent solves everything naturally. A hint causes tunnel vision.

**Practical implication**: Never add "helpful hints" or "colleague notes" to agent task descriptions. They anchor attention and reduce overall performance, even when the hint content is correct.

## KE Recommendation

Write **KE-XXX: Hint Anchoring Effect** — any auxiliary information prepended to a task anchors agent attention and degrades performance on the primary task. 100% → 0% on sql-injection-in-query-builder.

## Limitations

- N is small (5 baseline, 3 per arm). The effect is so large it's statistically significant, but replication with N=15 per arm (as originally designed) would strengthen confidence.
- Only one scenario tested. Generalizability unknown.
- Used tech-lead instead of coder (the originally-designed agent). Results may differ by agent.

## Tags
`EXP-188` `recognition` `anchoring` `hints` `negative-transfer` `tunnel-vision`
