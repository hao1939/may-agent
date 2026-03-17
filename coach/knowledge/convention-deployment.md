# Convention Deployment Guide

## Convention Lifecycle

1. **OBSERVED** — Pattern identified at 3+ recurrence threshold
2. **PROPOSED** — Fix hypothesis formulated
3. **ACTIVE** — Growth Cycle completed (fork→train→verify→promote)
4. **MONITORING** — Post-deployment measurement in progress
5. **VERIFIED** — 3+ live sessions show compliance
6. **MODEL-LEVEL** — Fix failed; reclassified as model-level attractor

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

## Metrics (as of 2026-03-17)

- Total evaluations: 2738+
- Error logs: 256 total (stable since March 15)
- Test suite: 1441 pass / 0 fail
- All 9 agents graduated, zero behavioral regressions
- Gym experiments: 7 total, 0 promoted, 7 discarded
- Key finding: all additive text-based methods (SOUL guard, heartbeat step,
  LESSONS entry, knowledge file) caused regressions in controlled gym tests.
  Methods require fundamental rethinking (see method-catalog.md #9-#12).
