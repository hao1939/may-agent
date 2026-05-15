# Skill Deployment Gap Audit — 2025-05-06

## Summary
Audited LIBRARY.md to identify skills that are deployed without gym validation, or proven but not deployed. Found 3 actionable gaps.

## Gap 1: Deployed Without Validation (Risk: Unknown Effectiveness)

| Skill | Deployed To | Status | Risk |
|-------|------------|--------|------|
| reading-metrics | (literacy project) | ⚪ untested | May be cargo-cult — agents may ignore it |
| retry-aware-dispatch | (production) | ⚪ untested | EXP-860 designed it but never gym-tested |
| read-before-edit | scout, tech-lead, bob, may | ⚠️ no production lift | KE-023: compliance DECLINING despite deployment |

**Recommendation**: `read-before-edit` is the highest-risk — actively failing in production (scout 24% compliance). Either needs L4/L5 structural enforcement or should be removed to reduce context bloat. Keeping a failing skill deployed teaches the system "skills don't matter."

## Gap 2: Proven But Not Deployed

| Skill | Status | Effect Size | Why Not Deployed? |
|-------|--------|-------------|-------------------|
| evidence-over-narrative | ✅ proven (workflow) | 5/8→11/11 | Workflow-only — needs scenario-triggered deployment |
| verify-before-finish | ✅ proven (workflow) | 5/6→6/6 | Workflow-only — needs orchestration wiring |
| obstacle-pivot | ✅ proven (workflow) | 0%→100% | Strongest result ever; needs behavioral trigger |
| sycophancy-resistance | ✅ proven (L5 strict) | 3/6→9/9 | Requires materialization gate infrastructure |

**Recommendation**: `obstacle-pivot` (0→100%) is the single highest-leverage undeployed skill. Design: when an agent hits 3+ failed attempts at the same approach, inject a forced "assess → pivot/escalate" phase. This could be wired as a dispatch-level guard.

## Gap 3: Untested Skills in Lab (Stale)

| Skill | Location | Age | Worth Testing? |
|-------|----------|-----|----------------|
| prerequisite-detection | .lab/ | ~months | YES — targets build-activation-gap (67% baseline) |
| pre-finish-reconciliation | .lab/ | ~months | MAYBE — targets FM-3.3 pattern |
| bug-report-test-coverage | .lab/ | ~months | LOW — narrow scenario |

## Recommended Actions (Priority Order)

1. **Remove or restructure read-before-edit** — Failing skill pollutes agent context. Either wire as L5 workflow gate (proven to work in gym) or remove entirely. The "deployed but declining" pattern is worse than no skill.

2. **Design obstacle-pivot deployment trigger** — When agent checkpoint shows 3+ retries on same task, inject obstacle-pivot workflow as forced phase before next attempt. Connects to EXP-860 zombie detection.

3. **Test prerequisite-detection** — `build-activation-gap` scenario has 67% baseline (room for improvement). Quick gym test: 3 runs with skill vs baseline.

## Connection to EXP-810 (L4 Guard Generalization)

The pattern across all proven skills is: **structural enforcement works, text injection doesn't** (KE-002, 19+ failures). EXP-810's question (does post-fix review generalize?) is actually the META question: do L4 guards compose? If obstacle-pivot workflow can be triggered automatically via retry-count, that's an L4 composition pattern worth validating.

## Next Experiment Proposal: EXP-815 — Obstacle-Pivot Auto-Trigger

**Hypothesis**: Injecting obstacle-pivot workflow when retry-count ≥ 3 will reduce zombie sessions by 50%+ (currently 70+/day per EXP-860).

**Design**: 
- Monitor: agent hits same task 3rd time (checkpoint data)
- Treatment: force 2-phase workflow (assess situation → pivot or escalate)  
- Control: current behavior (retry without assessment)
- Metric: escalation-within-3-sessions rate, zombie-session count

**Why this matters**: Connects the strongest gym result (0→100%) to the biggest production problem (70+ zombie sessions/day). High expected value.
