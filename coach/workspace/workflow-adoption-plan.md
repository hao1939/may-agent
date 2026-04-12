# Systematic Workflow Adoption Plan

**Date**: 2026-04-12 05:30 UTC  
**Author**: Coach  
**Status**: DRAFT — pending Hao's review  
**Context**: Hao asked for a systematic (not ad-hoc) approach to workflow-first adoption, with clear agent ownership.

---

## Design Principles

1. **Workflows are sync** — each workflow runs to completion in one session (Hao's decision)
2. **Explicit wiring required** — agents won't discover workflows spontaneously (EXP-028)
3. **Coach stays interactive** — Coach doesn't run workflows directly, stays available for commands
4. **Evidence-based** — each adoption decision backed by data

---

## Current State (51% coverage)

| Agent | Current Workflows | Coverage | Issue |
|-------|-------------------|----------|-------|
| **Bob** | `deliver-or-report` (39 runs), `parallel-research` (6) | HIGH | deliver-or-report 41% done rate |
| **Tech-Lead** | `implement-and-verify` (via coder, 3 runs) | LOW | Underutilized — should be primary coding workflow |
| **May** | None in current period | **ZERO** | Dispatches many sub-tasks, no workflow structure |
| **Scout** | `verify-wrap` (26 runs) | MEDIUM | verify-wrap works well, but scout also does unstructured research |
| **Optimizer** | None in current period | **ZERO** | Has `safe-edit`, `design-review`, `enhance-cron` — unused |
| **Coach** | None (intentional) | N/A | Stays interactive per Hao's directive |
| **QA** | None | ZERO | Has `vet-skill` — unused |

---

## Adoption Plan — By Agent

### Phase 1: Fix What's Broken (This Week)

**Owner: Tech-Lead (infra fixes)**

| # | Action | Workflow | Expected Impact |
|---|--------|----------|-----------------|
| 1 | Fix `deliver-or-report` escalation sensitivity | Bob's primary | 41% → 70%+ done rate |
| 2 | Wire `implement-and-verify` into tech-lead heartbeat as default for coding tasks | Shared | Cover all coding sessions |
| 3 | Audit why `verify-wrap` isn't catching Bob's C1.5 ghost deliverables | verify-wrap quality | Quality signal improvement |

### Phase 2: May Workflow Design (This Week)

**Owner: Optimizer (workflow design) + Coach (evidence review)**

May's pattern is unique — it's a **dispatcher** that:
- Receives human/Telegram messages
- Triages and routes to agents
- Often spawns sub-sessions

**Proposed**: `dispatch-and-track` workflow for May:
```
Phase 1: Parse input → classify task type → select target agent
Phase 2: Dispatch to agent (sync call or fork)
Phase 3: Verify dispatch result → report back
```

**Design constraint**: Must be sync (per Hao's directive). For May, this means:
- Simple dispatches: workflow completes when sub-agent finishes
- Complex multi-agent dispatches: May does sequential routing, not parallel

### Phase 3: Expand Coverage (Next Week)

**Owner: Optimizer**

| Agent | Workflow to Wire | Task Type |
|-------|-----------------|-----------|
| Optimizer | `safe-edit` for all file changes | Reliability |
| Optimizer | `design-review` before major changes | Quality gate |
| Scout | New `research-and-synthesize` (based on parallel-research) | Research tasks |
| QA | `vet-skill` in heartbeat for pending skill reviews | Quality |

### Phase 4: Measurement (Ongoing)

**Owner: Coach**

| Metric | How Measured | Target |
|--------|-------------|--------|
| Session coverage % | workflow runs / total sessions | 80% by Apr 19 |
| Done rate per workflow | status counts from .state/workflows/ | >70% each |
| Quality rate | Sampling + guard fire rates | Lower FM triggers |
| Regression detection | Monitor for workflow collapse (EXP-028 pattern) | Zero collapse events |

---

## Decision Points

1. **Async workflows**: Currently sync. Re-evaluate after Phase 2 (May's workflow) if latency is too high.
2. **Fork-based execution**: Explored but deferred. May revisit if sync creates bottlenecks.
3. **Coach workflow role**: Coach observes and measures, doesn't execute. May change if Coach needs to run training workflows.

---

## Responsibility Matrix

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Workflow Design** | Optimizer | Create/improve workflow code |
| **Wiring & Deployment** | Tech-Lead | Wire workflows into heartbeats/handlers |
| **Measurement & Evidence** | Coach | Track adoption, quality, regressions |
| **Prioritization** | May (via Hao) | Which workflows matter most |
| **Quality Review** | QA | Verify workflow outputs |

---

## Next Concrete Steps

1. **Tech-Lead**: Diagnose `deliver-or-report` escalation rate → fix
2. **Optimizer**: Design `dispatch-and-track` workflow for May
3. **Coach**: Set up measurement dashboard (workflow coverage, done rate, quality)
4. **Coach**: Report back to Hao with Phase 1 results in 48h
