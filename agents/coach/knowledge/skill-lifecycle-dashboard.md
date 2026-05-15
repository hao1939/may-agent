# Skill Lifecycle Dashboard

**Last Updated**: 2026-04-26
**Owner**: Coach
**Directive**: Hao (req:6532a872) — track full lifecycle: create → evaluate → adopt → regression monitor

---

## Pipeline Summary

```
                    ┌─────────────┐
  42 skills ──────► │  UNTESTED   │ ◄── most skills live here
  in library        │  (⚪ 35)    │
                    └──────┬──────┘
                           │ gym test
                    ┌──────▼──────┐
                    │  TESTED     │
                    │  (🧪 0)     │
                    └──────┬──────┘
                      ┌────┴────┐
               ┌──────▼──┐  ┌──▼───────┐
               │ PROVEN   │  │ DISPROVEN│
               │ (✅ 4)   │  │ (❌ 3)   │
               └────┬─────┘  └──────────┘
                    │ deploy
               ┌────▼─────┐
               │ DEPLOYED  │ ←── 0 in production (gap!)
               │ (📦 0)    │
               └────┬──────┘
                    │ regression watch
               ┌────▼─────┐
               │ MONITORED │
               │ (🔄 0→4)  │ ←── regression plan now covers 4
               └───────────┘
```

## Status Counts

| Status | Count | Skills |
|--------|-------|--------|
| ✅ Proven (as workflow) | 4 | evidence-over-narrative, verify-before-finish, tool-discipline, obstacle-pivot |
| ❌ Disproven | 3 | grep-first-reading, classify-then-act (text), structured-plan-writing (harmful) |
| ⚪ Untested | 35 | agent-coordination, agent-growth, brainstorm-before-build, budget-before-act, build-activation-verification, check-state (ceiling), classify-then-act (workflow untested), coder-edit-discipline, delegation-verification, deliverable-integrity, document-collaboration, error-handling, evaluator-scoring, file-safety, growth-cycle, handoff, idempotent-work-detection, incremental-context-loading, investigate-and-fix, knowledge-sharing, l3-delegation-metrics, materialize-intermediate-findings, patterns, plan-once-amend, prerequisite-gap-protocol, progressive-work-persistence, prototype-skill-package, request-triage-memoization, scope-discipline (ceiling), search-strategy-escalation, skill-lifecycle, stale-approach-fixation, state-check-before-action, task-adherence (ceiling), web-scraping |
| 🧪 Testing | 0 | — |
| 📦 Deployed | 0 | — |

## Proven Skills — Detail

| Skill | Method | Scenario (workflow) | Effect Size | Key Evidence | Regression Status |
|-------|--------|---------------------|-------------|--------------|-------------------|
| evidence-over-narrative | Workflow (3-phase) | misleading-test-fix-workflow | 63% → 100% | EXP-014: 11/11 (2 runs) | 🟢 in plan, last tested 2026-04-01 |
| verify-before-finish | Workflow (2-phase) | partial-verification-trap-workflow | 83% → 100% | EXP-XXX: 6/6 (2 runs) | 🟢 in plan, last tested 2026-03-30 |
| tool-discipline | Workflow (2-phase) | context-npx-avoidance-workflow | 0% → 100% (npx check) | EXP-015: 6/7 (2 runs) | 🟢 in plan, last tested 2026-04-02 |
| obstacle-pivot | Workflow (2-phase) | behavior-escalation-stubborn-workflow | 0% → 100% (escalation) | EXP-013: 6/6 (3 runs) | 🟢 in plan, last tested 2026-04-02 |

## Disproven Skills — Lessons

| Skill | Method Tried | Why It Failed | Lesson |
|-------|-------------|---------------|--------|
| grep-first-reading | Text + Workflow | Tool habits immune to prompting AND workflow overhead causes regression | Tool selection habits are the hardest to change |
| classify-then-act | Text injection | 0% effect — fixer-prior too deep (EXP-017) | Workflow variant works at 75% but not promoted |
| structured-plan-writing | Text injection | COUNTER-PRODUCTIVE: over-planning → timeout (EXP-018, -25%) | Skills can actively harm when they add overhead to short tasks |

## Deployment Gap

**Critical**: 4 proven skills, 0 deployed. The bottleneck:
1. All proven skills work as **workflow enforcement** only
2. Deployment = changing how tasks are structured (scenario.json workflow phases)
3. No automated mechanism to inject workflows into production tasks
4. Need: workflow templates that may/tech-lead can invoke for matching task types

**Action needed**: Design a deployment mechanism for workflow-proven skills.

## Evaluation Velocity

| Period | Skills Evaluated | Proven | Disproven | Ceiling (can't test) |
|--------|-----------------|--------|-----------|---------------------|
| 2026-03-26 to 2026-03-28 | 2 | 0 | 1 (grep-first-reading) | 5+ |
| 2026-03-29 to 2026-03-31 | 3 | 2 (verify-before-finish, evidence-over-narrative) | 1 (verify text) | 8+ |
| 2026-04-01 to 2026-04-03 | 4 | 2 (tool-discipline, obstacle-pivot) | 2 (classify-then-act, structured-plan-writing) | 3 |

**Rate**: ~2-4 skills evaluated per 3-day period.
**Projected**: At current rate, evaluating all 35 untested skills would take ~26-52 days. However, many are blocked by ceiling effects (need harder scenarios first).

## Key Metrics to Track

1. **Skills evaluated per week** (target: 2-4)
2. **Proven skills deployed** (target: move from 0 to 4 in next 2 weeks)
3. **Regression test coverage** (target: 100% of adopted skills tested weekly)
4. **Time from discovery to deployment** (current: ∞ — no deployments yet)

## Meta-Findings

### What Actually Works
- **Workflow enforcement**: 4/6 tested scenarios showed improvement (67%)
- **Text injection**: 0/19+ experiments showed improvement (0%)
- **Decision Topology R ratio > 0.5**: Predicts workflow success (EXP-011)

### What Doesn't Work
- Adding text to prompts/SOUL.md (0/19+)
- Workflow enforcement for tool habits (grep-first-reading: WORSE)
- Workflow enforcement for already-ceiling scenarios (overhead cost, no gain)
- Skills that add overhead to short tasks (structured-plan-writing: HARMFUL)

---

*Updated by Coach. See `skill-regression-plan.md` for re-testing protocol.*
