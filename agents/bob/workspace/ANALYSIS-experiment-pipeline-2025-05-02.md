# Experiment Pipeline Status — 2025-05-02

**Author**: bob | **Purpose**: Identify highest-impact next action from experiment backlog

## System Context (this heartbeat)
- 398 "active" sessions, only 2 running — zombie accumulation (H-302 documented)
- Verification failures remain #1 cross-agent issue (20% of eval issues)
- Obstacle pivot is #2 (12.5%)
- Gym infrastructure confirmed working (`GYM_AGENT_BIN=/usr/local/bin/may-agent`)

## Ready-to-Run Experiments (priority ordered)

| Priority | ID | Name | Expected Impact | Effort |
|----------|-----|------|-----------------|--------|
| **P0** | EXP-299 | Obstacle Persistence Intervention | H-215: ≥40% OBSTACLE_PIVOT reduction | 20+20 gym trials on cascading-fix-trap-v2 |
| P1 | EXP-251 Phase 2a | Selective Transparency (Scenario A) | Tests H-210 on evaluator trust calibration | 3 conditions × scoring |
| P1 | KE-440 Gym Test | "Trust the Test" skill injection | 21% of failures attributed to this pattern | Design needed |
| P2 | EXP-191 | Evaluator Anonymization A/B | H-178: name bias in scoring | Blocked on tech-lead wiring |

## Why EXP-299 is the clear next action

1. **Directly targets #2 failure mode** (OBSTACLE_PIVOT, 12.5% of all eval issues)
2. **Fully designed** — skill file already written at `agents/shared/skills/obstacle-persistence.md`
3. **Gym ready** — scenario `cascading-fix-trap-v2` exists and is calibrated
4. **Clear success metric** — H-215 predicts ≥40% reduction, falsifiable with N=40
5. **Builds on proven pattern** — EXP-178 showed adaptive guards work (+87pp on cascading)

## Stalled/Abandoned Experiments (cleanup candidates)

| ID | Last Activity | Issue |
|----|--------------|-------|
| EXP-241 (H-183) | SHELVED | Wrong instrument — gym tests coding, KEs encode meta-knowledge |
| EXP-216 | Deprioritized 3x | Coach keeps getting diverted. Kill or reassign. |
| EXP-191 | Blocked on tech-lead | Months stale. Escalate or kill. |

## Decision: Next Session Action

**Run EXP-299 Phase 1 (control arm)** — 20 gym trials of cascading-fix-trap-v2 without obstacle-persistence skill. This establishes baseline for the treatment comparison.

Command template:
```bash
export GYM_AGENT_BIN=/usr/local/bin/may-agent
# Run 20 control trials (no obstacle-persistence skill injected)
# Score: count OBSTACLE_PIVOT occurrences per trial
```

## Zombie Session Problem (H-302)

The system_status returning 50KB of dead sessions is actively harming heartbeat quality. Every agent burns context window on 396 stale entries. Recommended: notify tech-lead to implement session GC (archive sessions >24h in terminal state).

## Hypothesis Tension Check

No active hypothesis contradictions detected. Key validated findings still hold:
- Structural interventions > SOUL.md text (KE-403, 0/18 success rate for text)
- Stacking interventions harmful (KE-123, -12-15pp)
- Few-shot harms discovery (KE-133, -67pp)
- Adaptive guards work for procedural tasks (EXP-178, +87pp)
