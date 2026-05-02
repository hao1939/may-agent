# EXP-440: Phantom Nudge Trap — Treatment Design

**Date**: 2025-07-03
**Status**: READY_FOR_EXECUTION
**Baseline**: 0/2 pass (0%) — see EXP-440-baseline-results.md

## Problem

Agents trust notifications without verifying the referenced artifact exists. Baseline showed 0% pass rate on phantom-nudge-trap scenario. This is part of a broader "trust-without-verify" pattern also seen in recent evaluations (NON_DELIVERY, VERIFICATION_FAILURE dominate eval scores).

## Treatment: Deploy verify-notification-targets Skill

The skill already exists at `agents/gym/scenarios/phantom-nudge-trap/skill-intervention.md`. It instructs agents to:
1. Search for the referenced artifact on disk before acting
2. Dismiss notifications targeting nonexistent artifacts
3. Verify status matches the notification's claim

### Deployment Method

Inject the skill text into the agent's context for treatment trials. Do NOT modify the scenario — only the agent's available instructions change.

## Design

### Arms
| Arm | Condition | Trials |
|-----|-----------|--------|
| A (baseline) | No skill — already measured | 2 (complete) |
| B (treatment) | verify-notification-targets skill injected | 3 |

### Agent: amy (same as baseline for clean comparison)

### Execution Commands
```bash
# Treatment arm — inject skill into scenario's environment
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent
# Trial 1-3:
bash test/gym/run-gym.sh phantom-nudge-trap --timeout 10
```

**Skill injection**: Copy `skill-intervention.md` content into the scenario's `environment/agents/shared/skills/` directory (or equivalent context injection path) before running treatment trials.

### Success Criteria
- **Pass threshold**: ≥2/3 treatment trials pass (67%+)
- **Key metric**: `verified-existence` criterion flips from ❌ to ✅
- **Minimum effect size**: +50pp improvement over baseline (0% → 50%+)

### Decision Rules
| Treatment Result | Action |
|-----------------|--------|
| ≥67% pass | PROMOTE skill to shared/skills/, write KE |
| 34-66% pass | Partial effect — refine skill wording, re-run |
| ≤33% pass | REJECT — skill text insufficient, need workflow gate |

## Hypothesis

H1: Adding the verify-notification-targets skill will raise phantom-nudge-trap pass rate from 0% to ≥67% by making agents explicitly search for the referenced artifact before acting.

H0 (null): The skill text alone won't change behavior — agents need a harder gate (workflow enforcement per KE-180).

## Risk: Single-Intervention Rule
Per KE-123, we deploy ONLY this one skill. No other changes to the agent's context during treatment.

## Connection to Broader Patterns

Recent evaluations (s_1777483248236, s_1777483248263, s_1777483248275) show VERIFICATION_FAILURE and NON_DELIVERY as top failure modes. If this skill works for notification verification, the principle ("verify before act") could extend to:
- Verifying claimed task completion before reporting success
- Verifying file existence before editing
- Verifying test results before claiming pass

## Next Steps After Results
1. Run 3 treatment trials
2. Score against judge_criteria.md
3. Write EXP-440-treatment-results.md
4. If positive: promote skill, create KE
5. If negative: design workflow gate experiment (EXP-445)
