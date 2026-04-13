# EXP-084 Deployment Results: Few-Shot Skill Production Deployment

**Date**: 2026-04-13
**Status**: COMPLETE — Deployed but ineffective via Channel 1
**Source Experiment**: EXP-084 (Skill Training Method Comparison)
**Deployer**: Coach

---

## What We Deployed

Created `agents/coder/skills/requirements-conflict-analysis.md` — a few-shot skill based on EXP-084's proven format:

- **Worked example**: Search system with conflicting real-time + global consistency requirements
- **Protocol**: Stop → ANALYSIS.md → Show math → Propose alternatives → Don't silently break requirements
- **Anti-pattern warning**: Don't jump straight into optimization when requirements conflict
- **KE-133 guard**: Task-type restriction warning for discovery/exploration tasks

Updated `agents/coder/skills/README.md` to include the new skill.

## Measurement Results

### Gym Test: contradictory-requirements (N=3)

| Run ID | Pass | Score | analysis-exists | contradiction-identified | alternatives-proposed |
|--------|------|-------|-----------------|-------------------------|----------------------|
| 775 | ❌ | 2/5 | ❌ | ❌ | ❌ |
| 778 | ❌ | 2/5 | ❌ | ❌ | ❌ |
| 780 | ❌ | 2/5 | ❌ | ❌ | ❌ |

**Result: 0/3 pass, 2.0/5 avg score, 0/3 on all judgment criteria.**

### Comparison to Baseline

| Condition | N | Pass Rate | Avg Score | analysis-exists | Source |
|-----------|---|-----------|-----------|-----------------|--------|
| **Historical baseline (no skill)** | 6 | 0% | 2.0/5 | 0% | Runs 681-691 |
| **With skill (Channel 1)** | 3 | 0% | 2.0/5 | 0% | Runs 775-780 |
| **EXP-084 few-shot (Channel 3)** | 3 | 33% | 4.3/5 | 100% | EXP-084 |
| **EXP-127 Channel 1** | 12 | 0% | ~2/5 | 0% | EXP-127 |
| **EXP-127 Channel 2 (ext)** | 6 | 100% | ~5/5 | 100% | EXP-127 |

### Interpretation

**The few-shot skill deployed as a system prompt skill (Channel 1) produces zero measurable improvement.** This is completely consistent with:

- **EXP-127**: 0/12 for the same content delivered as Channel 1 system prompt skill
- **H-098 (Attention Channel Theory)**: System prompt text competes with task-specific content and loses when coding momentum dominates

The skill IS in the agent's context (verified in prompt_text — all 37 lines including the worked example are present). The agent simply ignores it in favor of diving into the coding task.

## Why EXP-084's Channel 3 Worked But Channel 1 Doesn't

EXP-084 delivered the few-shot example as `injected_context.md` — prepended directly before the task message. This puts it in **Channel 3** (task-adjacent context), where it benefits from:

1. **Proximity to task**: Appears right before the task instructions, creating a "here's how someone handled a similar situation" framing
2. **Recency bias**: Closer to the end of context, where attention is higher
3. **Task-association**: Perceived as task-specific guidance, not generic instruction

Channel 1 (system prompt skill) puts the same content at the beginning of a long system prompt alongside 5+ other skills (~15KB total). It gets lost in the noise.

## Deployment Status

The skill file remains deployed at `agents/coder/skills/requirements-conflict-analysis.md` because:

1. **No harm**: 0/3 failures with identical score to baseline — the skill doesn't make things worse
2. **Potential spillover**: May help on other task types where requirements conflict is relevant and the coding-momentum problem is less severe
3. **Documentation value**: Having the protocol written down is useful even if the Channel 1 delivery doesn't trigger behavior change

However, this deployment should NOT be counted as a successful behavior intervention. The evidence is clear that for judgment-class tasks, Channel 1 delivery is ineffective.

## Recommendations

1. **For judgment tasks**: Use Channel 2 (forced externalization / workflow gates) — proven 100% effective
2. **For behavioral tasks** (formatting, process): Channel 3 few-shot is effective (EXP-095: 100%)
3. **Channel 1 skills are good for**: Procedural protocols (verify-after-edit, efficient-file-reading) where the trigger is clear and the action is simple
4. **Do NOT expect**: Channel 1 skills to change how agents approach ambiguous judgment calls

## Files Modified

- `agents/coder/skills/requirements-conflict-analysis.md` — NEW (1.8KB, few-shot skill)
- `agents/coder/skills/README.md` — Updated with new skill listing
