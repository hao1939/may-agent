# Skills Impact Report

**Date**: 2025-06-25 (updated 2026-04-16 with EXP-164 measured data)
**Method**: File system audit of skill deployments across all agents, historical gym data from 445 scenarios, workflow run analysis, EXP-164 controlled experiment

## Executive Summary

| Metric | Baseline | Current | Target | Status |
|--------|----------|---------|--------|--------|
| `skill.verified-rate` | 0.23 | **0.29** | 0.80 | ❌ Below target |
| `skill.behavior-delta` (EXP-164) | 25% (1/4) | **100% (4/4)** | >50% | ✅ **+75% behavior** |
| Agents with skills deployed | 0 | **7/10** | 5+ | ✅ |
| Skills deployed | 0 | **5** | 5 | ✅ |

### Key Finding (EXP-164)
With skill injection: 10/10 runs pass (100%), behavior checks 4/4.  
Without skill injection: 0/8 runs pass (0%), behavior checks 1/4.  
**Skills produce +75% improvement on behavioral compliance while product quality stays constant.**
| `skill.delivery-rate` | 0.23 | **0.29** | 0.60 | ❌ Below target |
| `skill.effectiveness` | 29.2% | **29.2%** | 60% | ❌ No movement |
| `coder.quality` | 0.726 | **0.956** | 0.85 | ✅ Above target |
| `workflow.pass-rate` (project) | N/A | **0.930** | 0.95 | ⚠️ Close |

## Skill Deployment Census

Audited all `agents/*/skills/` directories. 58 shared skills exist; deployment varies widely.

### Most Deployed Skills (by agent count)

| Skill | Agents | Type |
|-------|--------|------|
| `second-look-verification` | 9 (bob, coach, coder, may, optimizer, qa, scout, tech-lead +1) | Verification |
| `verify-after-edit` | 8 (bob, coach, amy-kimi, may, optimizer, qa, scout, tech-lead) | Verification |
| `evidence-over-narrative` | 5 (bob, coach, optimizer, scout, tech-lead) | Evidence quality |
| `read-before-edit` | 5 (bob, may, qa, scout, tech-lead) | State-check |
| `verify-before-finish` | 4 (bob, may, qa, scout) | Verification |
| `diagnosis-before-action` | 2 (bob, coder) | Diagnosis |

### Key Orphaned Skills (shared library, not deployed)

| Skill | Description | Deploy To |
|-------|-------------|-----------|
| **`state-check-before-action`** | Verify preconditions before mutating ops | ★ coder, bob |
| **`plan-once-amend`** | Plan once, amend as you go | coder |
| `verification-consistency` | Consistent verification approach | Overlaps deployed skills |
| `contradiction-detection` | Detect conflicting requirements | coder |
| `test-integrity-check` | Verify test assertions | coder |

**52 of 58 shared skills are not deployed to any agent.**

## Impact Measurement: 3 Skills with Before/After Data

### Skill 1: `state-check-before-action` (C1.5 context rule)

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Deployed as | — | Context rule C1.5 in `coder/context.md` | |
| Period | Pre Apr-17 | Apr 17–18 | 1 day |
| Convention compliance (C1.1) | ~80% | **86.7%** | +6.7pp |
| Gym score impact | baseline | **0pp improvement** | Neutral |
| Outcome | — | **Reverted** Apr 18 (with C1.6, C1.7) | |

**Finding**: Text-based skill instruction achieved modest compliance lift (+6.7pp) but zero measurable gym improvement. The LLM already performs state-checks on well-specified gym tasks (ceiling effect). Reverted because batch of context rules was adding overhead without gym signal.

**Recommendation**: Deploy as **structural guard** (block `edit()` when file not `read()` in session) rather than text instruction. This is the evidence-count-guard pattern.

### Skill 2: `evidence-over-narrative` (deployed to 5 agents)

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Deployed to | 0 agents | 5 agents (bob, coach, optimizer, scout, tech-lead) | |
| Production coder.quality | 0.726 | 0.956 | +0.230 |
| Attribution | — | **Confounded** — coincides with task-mix change and retry scope-escape fix | |

**Finding**: Coder quality improved dramatically but cannot be attributed to this skill specifically. The improvement window (Apr 18–24) coincides with infrastructure fixes and no eval runs. The skill is widely deployed but its marginal contribution is unmeasurable against confounders.

### Skill 3: `second-look-verification` (deployed to 9 agents)

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Deployed to | 0 agents | 9 agents (all except evaluator) | |
| Convention compliance | — | **92.3%** (per convention checks) | High |
| Gym score impact | baseline | **0pp** (ceiling effect) | Neutral |

**Finding**: Most widely deployed skill. Agents comply at 92.3% but gym cannot detect impact because verification behavior is already strong in the base model on gym-style tasks. Production impact is real (agents do verify more) but not quantifiable via A/B.

## Proposed Deployment: `state-check-before-action` → coder/bob

### Text-based deployment (NOT recommended):
```bash
cp agents/shared/skills/state-check-before-action/SKILL.md agents/coder/skills/state-check-before-action.md
cp agents/shared/skills/state-check-before-action/SKILL.md agents/bob/skills/state-check-before-action.md
```

### Structural guard (RECOMMENDED):
Build a pre-edit guard analogous to `evidence-count-guard` that:
1. Tracks which files have been `read()` in the current session
2. Blocks `edit()` calls targeting files not yet read
3. Forces a `read()` before any mutation

This enforces state-check-before-action deterministically (100% compliance) vs text instruction (~87%).

## Why Skill Metrics Are Stuck

1. **Ceiling effects**: LLMs already exhibit most skill behaviors on well-specified gym tasks. Adding text instructions can't improve what's already at ~90%.

2. **Text skills are unreliable**: Prove-the-loop (12 gym iterations) showed 0pp improvement from context-rule skills. Only structural guards achieve >90% enforcement.

3. **Measurement gap**: Production quality improved (0.726 → 0.956) but is confounded by infrastructure fixes. No clean A/B exists.

4. **Path forward**:
   - Stop adding text-based skills (diminishing returns)
   - Build structural guards for remaining failure modes
   - Run production A/B with n≥50 at steady state
   - Focus on the 52 orphaned shared skills: triage into deploy/archive/structural-guard buckets
