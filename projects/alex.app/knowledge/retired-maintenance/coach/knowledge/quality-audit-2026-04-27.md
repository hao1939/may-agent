# Skills & Workflows Quality Audit
**Date**: 2026-04-27 | **Author**: Coach heartbeat

## Summary

The system has **156 skill files** across 12 agents and shared, plus **11 workflow files**. However, **quality measurement infrastructure is broken**: no gym runs on record, no evaluations since Apr 16 (and those were all "skipped"), no convention checks in the last 7 days. We cannot assess whether skills are working because we have no measurement data.

## Skills Inventory

| Agent | Count | Notes |
|-------|-------|-------|
| shared | 81 | Library of reusable skills (incl. 11 archived) |
| bob | 13 | Most per-agent skills |
| scout | 10 | |
| coach | 9 | |
| tech-lead | 9 | |
| optimizer | 8 | |
| may | 6 | |
| evaluator | 6 | |
| coder | 5 | |
| qa | 5 | |
| amy | 2 | |
| amy-kimi | 2 | |
| **Total** | **156** | |

### Widely Deployed Skills (appear in 5+ agents)
- `second-look-verification` — 7 agents + shared (most recent updates Apr 26-27)
- `verify-after-edit` — 6 agents
- `read-before-edit` — 4 agents
- `verify-before-finish` — 4 agents
- `evidence-over-narrative` — 4 agents + shared

### Shared Archive (potentially dead)
- **7 untested**: incremental-context-loading, check-state, stale-approach-fixation, brainstorm-before-build, task-adherence, search-strategy-escalation, scope-discipline
- **3 disproven**: grep-first-reading, investigate-and-fix, classify-then-act
- **6 unreferenced**: extract-directives, constructive-friction, verify-before-finish-micro, critical-pause, synthesis-dpir, experiment-before-apply

## Workflows Inventory

All in `agents/shared/workflows/`:
- `implement-and-verify.ts` — core build workflow
- `heartbeat-data.ts` — heartbeat data gathering
- `project.ts` / `project-helpers.ts` — project management
- `master-worker.ts` — delegation pattern
- `error-scan.ts` — error scanning
- `verify-wrap.ts` / `freestyle-wrap.ts` — task wrappers
- `coaching-feedback.ts` — coaching integration
- `fewshot-inject-helpers.ts` — few-shot example injection
- `REGISTRY.md` — workflow registry

No per-agent workflows exist — all are shared.

## Quality Measurement Status: BROKEN

| System | Status | Last Data |
|--------|--------|-----------|
| Gym runs | **Empty** | Table rebuilt after DB corruption, 0 records |
| Evaluations | **Stale** | Apr 16 — all "skipped" with q:0, e:0 |
| Convention checks | **Stale** | No data in last 7 days |

**Root cause**: The May DB was corrupted and rebuilt on Apr 27. Gym_runs table was recreated empty. Evaluator hasn't run meaningful evaluations since March 24 (per todo.md).

## Key Findings

1. **Skill proliferation without validation**: 156 skills exist but zero gym runs to test them. We're accumulating skills on faith.
2. **second-look-verification is the most deployed skill** (7+ agents) but has never been A/B tested in gym.
3. **16 archived skills** are dead weight — 7 untested, 3 disproven, 6 unreferenced. The disproven ones have evaluation docs.
4. **No per-agent workflows** — all workflow logic is shared, which is good for consistency but means no agent-specific process tuning.
5. **Evaluation pipeline is the #1 blocker** — without it running, we cannot measure anything.

## Recommendations

1. **P0: Restart evaluator** — notify evaluator agent to resume scoring sessions
2. **P1: Run gym baseline** — pick 5 core scenarios, run each agent through them to rebuild gym_runs data
3. **P1: Test second-look-verification** — it's the most deployed skill; design an experiment to measure its actual impact
4. **P2: Clean archived skills** — remove or document the 16 archived skills; the 3 disproven ones should have clear "do not use" markers
