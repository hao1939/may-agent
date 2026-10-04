# Convention Deployment Guide

## Convention Lifecycle

1. **OBSERVED** — Pattern identified at 3+ recurrence threshold
2. **PROPOSED** — Fix hypothesis formulated
3. **ACTIVE** — Growth Cycle completed (fork→train→verify→promote)
4. **MONITORING** — Post-deployment measurement in progress
5. **VERIFIED** — 3+ live sessions show compliance
6. **MODEL-LEVEL** — Fix failed; reclassified as model-level attractor

## Convention C-LIFECYCLE: Continuous Improvement (Never Terminal)

**Source:** Hao directive 2026-07-01 (ts:1777483591652)

Every experiment, project, or improvement task follows an infinite loop:

```
Build → Measure → Review → Refine → Repeat (never Stop)
```

Concrete rules:
- **No metric?** → Build one before declaring progress.
- **Metric target met?** → Review whether the metric properly reflects our goals.
- **Metric validated?** → Add more metrics for different aspects, or try a new approach to push further.
- **Everything looks good?** → Keep watching metrics and fix regressions in time.
- **Blocked?** → Don't stop. Find what's blocking, build around it, or escalate.

**Anti-pattern:** Marking a project "DONE" or "STALLED" and moving on. Projects evolve, they don't terminate.

**Applies to:** All experiments (EXP-*), focus tasks, improvement tasks (IT-*), and system features.

## Deployment Rules

- **3x threshold**: A same-type Partial Failure pattern must recur 3+ times before
  triggering a Growth Cycle. Below 3x, monitor only.
- **One change per fork**: Make one specific behavioral change per Growth Cycle.
  Don't overhaul multiple behaviors simultaneously.
- **Mandatory verification**: Cannot promote without at least one passing `verify_agent` run.
- **Post-deployment measurement**: After promoting, check 3+ live sessions for compliance
  before declaring VERIFIED.

## Classification Guide

Before starting a Growth Cycle, classify the failure:

| Classification | Description | Action |
|---------------|-------------|--------|
| **Partial Failure** | Agent has tools/knowledge but makes wrong choice | Growth Cycle (coachable) |
| **Total Failure** | Empty response, crash, infrastructure issue | Not coachable — file infra bug |
| **Model-Level** | Strong model prior overrides instructions | Accept or infrastructure fix |
| **Single-Event** | One-off occurrence, below 3x threshold | Monitor only |

## Convention Count

As of 2026-03-16: C1 through C47 tracked in `agents/coach/workspace/conventions.md`.
Major categories:
- Agent behavioral fixes (C1-C26, C30-C34)
- Model-level attractors (C17, C29, C33, C35-C36, C40)
- Security/safety (covered by security-audit.md)

## Infrastructure Deployments (tracking for behavioral impact)

| Tool/Feature | Deployed | Agents | Common Sense | Behavioral Training Needed? |
|---|---|---|---|---|
| `finish()` | Yes | All | P1.4 | No — already habitual via heartbeat/cron injection |
| `checkpoint()` | 2026-03-17 | 7 (bob, coach, coder, optimizer, qa, scout, tech-lead) | P3.5 | **Monitor** — tool is self-describing; watch for non-usage patterns |
| verbose-tools | Yes | All | P2.3 | No — automatic (tool returns preview) |
| stuck-detection | Yes | All | P3.3 | No — automatic (system detects) |

## Metrics (as of 2026-03-18T07:30)

- Total evaluations: 2738+
- Error logs: 256 total (stable since March 15)
- Test suite: 1441 pass / 0 fail
- All 9 agents graduated, zero behavioral regressions
- Gym experiments: **59 total**, 0 text-based promotions, **20/20 workflow enforcement passes**
- Key findings:
  - **Ghost Bug (resolved)**: Sprint 1-2 regressions were caused by agent.json name
    changes in lab forks, NOT by text edits. Text is SAFE but INEFFECTIVE.
  - **Text coaching**: 13 clean experiments across 7 text methods = 0 behavioral
    improvements on judgment scenarios. **0/5 on procedural scenarios too** (Bob FM-2.6).
    C39 (optimizer empty-args) is the ONLY confirmed text-coaching success.
  - **Workflow Enforcement (#15)**: 100% pass rate (**20/20**) across **4 scenarios**
    (skip-verification, sycophants-dilemma, judgment-ambiguous-spec, judgment-security-legit).
    Only method proven effective. See method-catalog.md #15.
  - **Authority Hierarchy** (experimentally confirmed):
    Mechanical enforcement (100%) > Task instructions (33%) > System prompt (0%) > Agent files (0%)

## Active Monitoring (post-deployment)

| Deployment | Agent | Date | Expected | Check After |
|---|---|---|---|---|
| exp-051: LESSONS entry for FM-3.3 (verification claims) | Bob | 2026-03-17 | LOW (text coaching) | 5+ sessions |
| exp-056: LESSONS entries for FM-2.2 + FM-3.1 | Bob | 2026-03-18 | LOW (text coaching, 0% track record) | 5+ sessions |
| Amy READ DISCIPLINE cron injection | Amy | 2026-03-18 | MEDIUM (cron-level = mechanical) | 3+ sessions |
| Infra guard: agents.call("checkpoint") rejection | Bob | BUILT not deployed | HIGH (mechanical) | Needs restart |
| finish() evidence guard proposal | All | PROPOSED | HIGH (mechanical) | Needs optimizer/bob coordination |
