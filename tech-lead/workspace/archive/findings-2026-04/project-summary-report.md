# Project Summary Report

**Generated**: 2026-04-20  
**Source**: All `project.md` files across `agents/*/workspace/projects/`

---

## Active Projects (3)

| Project | Owner | Status | Iteration | Milestones |
|---------|-------|--------|-----------|------------|
| feedback-loop | may | active | 6 | — |
| context-injection-implementation | may | active | 5 | — |
| metrics-and-gym | may | active | 5 | 6/6 ✅ (stale active) |

## Blocked Projects (3)

| Project | Owner | Status | Iteration | Blocker |
|---------|-------|--------|-----------|---------|
| instruction-following | coach | blocked | — | Needs gym experiments |
| prove-the-loop | coach | blocked | 4 | — |
| metric-system (shared) | may/tech-lead | Phase 3 blocked | — | Process restart needed |

## Done Projects (18)

| Project | Owner | Iteration |
|---------|-------|-----------|
| context-learning | bob | — |
| exp166-execution | bob | — |
| exp167-runs | bob | 3 |
| startup-overhead-measurements | bob | 2 |
| test-persistent-task (startup overhead) | bob | 28 |
| learn-from-existing-systems | bob | — |
| agent-autonomy | coach | 16 |
| metric-autonomy | coach | — |
| project-tracking-db | tech-lead | 6 |
| context-management | tech-lead | 5 |
| fix-verify-wrap | tech-lead | 3 |
| metric-system-phase1 | tech-lead | — |
| verification-streamline | tech-lead | 7 |
| cold-start-fix | tech-lead | 14 |
| metric-reactivity | may | 5 |
| guard-friction-analysis | may | 9 |
| system-evolution | may | — |
| metric-reaction-investigation | may | 3 |
| review-branch-merge | may | — |
| context-injection-review | may | — |
| metrics-dashboard | may | — |
| adaptive-heartbeats | may | 17 |
| metric-system | may | 3 |

## Cancelled Projects (1)

| Project | Owner | Reason |
|---------|-------|--------|
| auto-resume | tech-lead | Hao directive: no auto-resume |

## Monitoring (1)

| Project | Owner |
|---------|-------|
| breadcrumb-gap | coach |

---

## Key Stats

- **Total projects**: 26
- **Done**: 18 (69%)
- **Active**: 3 (12%)
- **Blocked**: 3 (12%)
- **Cancelled**: 1
- **Monitoring**: 1
- **Highest iteration count**: 28 (bob/test-persistent-task)
- **Design doc produced**: `.state/designs/project-tracking-db.md` (DB schema for tracking)

## Notable Findings

1. **3 "active" projects may be stale** — metrics-and-gym has 6/6 milestones done but status still "active"
2. **Phase 3 of metric-system blocked** on process restart — has been blocked since creation
3. **coach has 2 blocked P0 projects** (instruction-following, prove-the-loop) — potential bottleneck
4. **bob completed the most projects** (6) with highest iteration depth (28)
