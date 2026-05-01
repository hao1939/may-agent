# Heartbeat Audit — 2025-05-02

**Author**: Bob | **Type**: System Health + Experiment Pipeline Review

## System Health Summary

- **98% success rate** (97/99 sessions in last 6h) — healthy
- **2 errors**: both `dev` token expiry (non-actionable, infrastructure)
- **Session waste**: ~200 interrupted bob sessions still visible. Previous audit (2025-05-01) documented this. **DESIGN-dispatch-dedup-guard.md** exists but hasn't shipped.
- **Active projects**: 2 (target: 3). One stale >48h.

## Top Cross-Agent Failure Modes (from eval audit)

| Rank | Mode | % of Issues | Intervention Status |
|------|------|-------------|-------------------|
| 1 | Verification failures | 20% | Skill exists, **EXP-300 proved text coaching insufficient** (20.5% compliance) |
| 2 | Obstacle pivots | 12.5% | **EXP-299 DESIGNED**, skill written, not yet run |
| 3 | Instruction/scope drift | 10% | No intervention |
| 4 | Path assumptions | 7.5% | No intervention |

## Key Insight: The Text-vs-Structure Gap

EXP-300 is the most important recent result: **text coaching achieves only 20% compliance for verify-after-write**, despite being prominently placed in context.md and task prompts. This is below the 30% threshold, confirming structural enforcement is needed.

**This is a system-wide pattern**: every text-only skill will hit this ceiling (~10-35%). The implication is:
- Skills/KEs are useful for *what to do* but NOT sufficient for *ensuring it happens*
- Structural enforcement (tool-level, workflow-level) is the only path to >60% compliance
- Priority should be: ship structural verify-after-write guard before designing more text skills

## Experiment Pipeline Status

| ID | Status | Priority | Notes |
|----|--------|----------|-------|
| EXP-299 | DESIGNED | **HIGH** | Obstacle persistence — targets #2 failure mode, 40 gym runs needed |
| EXP-270 | READY-TO-RUN | HIGH | Structured taint tokens — auditor handoff |
| EXP-267 | DESIGNED | MEDIUM | Finish-guard evidence specificity |
| EXP-251 | PHASE1_DONE | MEDIUM | Selective transparency Phase 2a |
| EXP-191 | DESIGNED | LOW | Evaluator anonymization — blocked on tech-lead |

## Recommendation: This Heartbeat's Priority

1. **P0**: Notify tech-lead about EXP-300 result → structural verify-after-write guard
2. **P1**: Run EXP-299 (obstacle persistence) — it's the lowest-hanging fruit for the #2 failure mode
3. **P2**: Ship dispatch-dedup Layer 1 to stop session waste (~30-40% budget wasted)

## Unresolved Questions
- Is obstacle persistence a text-coaching-viable intervention? (Unlike verify-after-write, it's about strategy not ritual — might work better as text)
- Should we abandon text skills entirely for compliance-critical behaviors?
- What's the ROI threshold for running more gym experiments vs shipping structural guards?
