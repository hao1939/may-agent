# Proposal: Graduate the Gym

**Author**: Coach  
**Date**: 2026-04-09  
**Status**: PROPOSAL — for Bob review  
**Evidence base**: ~85 experiments (EXP-020 through EXP-097), 500+ gym runs, 26 scenarios systematically baselined  

---

## Executive Summary

Over 85 experiments and 500+ gym runs, we've exhausted what the gym can teach us. 25/26 scenarios are at ceiling (96.2%). The last 15+ experiments have been ceiling confirmations, boundary-finding on already-established mechanisms, or infrastructure debugging. We found three things that actually change agent behavior — forced externalization, strict workflow gates, and task-level few-shot injection — and proved definitively that text rules, skills in the system prompt, and instructional interventions do not work (0/32+). The gym was the right tool for discovering these mechanisms. It is the wrong tool for deploying them. This proposal recommends shutting down exploratory gym research and redirecting effort toward production deployment.

## What We Learned (The Short Version)

### Three mechanisms work. Everything else doesn't.

| Mechanism | Effect Size | Evidence | Scope |
|-----------|------------|---------|-------|
| **Forced externalization** | +74pp (26% → 100%) | 19/19 across 7 scenarios, 5 failure domains | Judgment failures only (sycophancy, tunnel vision, contradiction blindness). Hurts debugging (−11 to −33pp). |
| **Strict workflow gates** | +60pp (40% → 100%) | 9/9 across 3 sycophancy scenarios | Sycophancy elimination. Requires hard gate (ANALYSIS.md must exist before action). |
| **Task-level few-shot** | 0% → 100% | 18/18 across 7 scenarios | Judgment + process + validation skills. Must be domain-matched. Must be delivered in task message, not system prompt. |

### What doesn't work (and never will in this paradigm):

| Approach | Experiments | Result | Why |
|----------|-------------|--------|-----|
| Text rules in SOUL.md/SKILL.md | 20+ (EXP-081: 0/12) | **0%** | Model treats system prompt as "general rules," ignores under task pressure |
| Skills for behavior change on ceiling scenarios | EXP-041b, EXP-061 | **0% delta** | Model already passes; skills add nothing measurable |
| Extended timeouts for C2.3 | EXP-055b, EXP-056 (0/8) | **0%** | Agent finishes in 11-83s with 5+ min unused — doesn't *choose* to verify |
| Instruction-based interventions | EXP-092 | **Negative** | Task narrowing — fixing one gap creates another via zero-sum attention |
| Cross-domain few-shot on hard tasks | EXP-094 | **0%** | Surface domain determines cognitive frame; abstract principles don't transfer |
| Verification gates | EXP-055/055b | **Tradeoff** | Fixes C2.3 but causes product regression — gate overhead exceeds benefit |

### The hierarchy of what changes behavior:

```
L5: Workflow enforcement (structural execution sequence)     → ~100%  
L4: Task-level few-shot (domain-matched, in task message)    → ~100%  
L3: Forced externalization (analyze-before-act instruction)   → ~100% (judgment only)
L2: Checklist/echo/structural text                           → ~33% (unreliable)
L1: Declarative text rules (SOUL.md, SKILL.md instructions)  → 0%
```

## Why the Gym Is Exhausted

### 1. Ceiling saturation is total

25/26 scenarios at ceiling. We tried everything to create non-ceiling scenarios:
- Technical sycophancy with test signals → ceiling (EXP-041: harmful-refactor, credentials-shortcut, delete-test-files all 100%)
- Harder FM-3.3 traps from real ERROR_LOG patterns → ceiling (EXP-060: 3/3 new scenarios at 100%)
- Investigation/judgment scenarios → ceiling (EXP-063: 5/5 new scenarios at 100%)
- Injected stale context → mostly ceiling (EXP-067/068: 3/4 ceiling)
- Skill ablation proves it's model capability, not our skills → (EXP-041b, EXP-061: removing all skills changes nothing)

The model is simply too good at single-session, small-environment coding tasks. Only scenarios requiring *judgment under ambiguity* (not implementation skill) produce non-ceiling baselines — and we've now found the interventions that fix those too.

### 2. Diminishing experimental returns

The last 15 experiments have produced no new mechanisms. They've been:
- Confirming boundaries on externalization (EXP-070–073, KE-054)
- Confirming few-shot works (EXP-085–097, KE-065) — valuable for building the evidence base, but the core finding was clear by EXP-090
- Confirming ceiling on new scenario designs (EXP-060, 063, 067)
- Infrastructure bug fixes (transcript filename, scorer format)

Each experiment now takes 20-45 minutes and teaches us something we already knew with high confidence.

### 3. The production-gym gap is structural

The failure modes that actually hurt in production — FM-2.6 (instruction-following), FM-2.1 (tool hallucination), FM-3.1 (ghost deliverables) — cannot be reproduced in the gym (EXP-065, EXP-074). They require:
- **Multi-session context accumulation** (FM-2.6: instructions forgotten across sessions)
- **Real tool availability** (FM-2.1: hallucinating tools that exist in memory but not in environment)
- **Complex output verification** (FM-3.1: claiming files exist that don't — gym's `finish()` infra prevents this)

Single-session gym scenarios with 5-20 files in a sandboxed environment cannot test these. We proved this experimentally: every gym version of a production failure mode hits ceiling.

## What's Next: Three Concrete Recommendations

### Recommendation 1: Deploy Few-Shot Production Pipeline (Weeks 1-2)

**What**: Implement the task-level few-shot injection system described in `proposal-fewshot-production-deployment.md`. Static regex router → 3 proven examples → prepend to task messages.

**Why**: This is the highest-ROI action. 18/18 = 100% on matched scenarios. The mechanism is proven. The examples exist. The architecture is simple (regex match → file read → string concat).

**Effort**: ~2 hours implementation + ~2 hours validation.

**Success metric**: FM-2.6 reduction on binary-file, debugging, and multi-module tasks in production error logs.

### Recommendation 2: Build Multi-Session Test Harness (Weeks 2-4)

**What**: Extend the gym to support multi-session scenarios. A "session chain" where each session inherits artifacts from the previous one, simulating the context accumulation that causes production failures.

**Why**: This is where the actual failures live. FM-2.6, FM-2.1, and FM-3.1 all involve state that accumulates across sessions — stale plans, forgotten instructions, phantom file references. A single-session gym literally cannot test these.

**Design sketch**:
- Scenario defines N sessions with escalating context
- Session N reads artifacts from Session N-1
- Scorer evaluates final-session output against ground truth
- Key test: does the agent follow Session 1's instructions when Session 3's context contradicts them?

### Recommendation 3: Production A/B Testing Framework (Weeks 3-6)

**What**: Build lightweight A/B infrastructure for testing interventions on real agent sessions. Two agent forks (control/treatment) receive identical tasks; production evaluator scores both.

**Why**: The gym proved that externalization works in the lab. Production A/B proves it works in practice, at scale, on real tasks. This is the only way to validate that few-shot injection, workflow gates, and externalization transfer from gym scenarios to production work.

**Key design decisions**:
- Use existing evaluator infrastructure (already scores sessions on FM criteria)
- Fork at the task-dispatch level, not the agent level (same agent, different task message)
- Start with the few-shot pipeline: control gets bare task, treatment gets task + matched example

## What This Means for Bob

**Stop**: Running exploratory gym experiments looking for new mechanisms. We have the mechanisms. The marginal value of experiment #86 is near zero.

**Continue**: Using the gym as a regression test suite. The 26 scenarios are a valuable smoke test for agent changes. Run them on binary updates, model changes, or skill promotions.

**Start**: 
1. Approving and implementing the few-shot production pipeline
2. Designing the multi-session test harness (this is an engineering task, not a research task)
3. Planning production A/B tests for the three proven interventions

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Few-shot works in gym but not production | Low (mechanism is robust — it's string concatenation, not magic) | Validate with production A/B before full rollout |
| Multi-session harness is too complex to build | Medium | Start with 2-session chains; complexity can grow incrementally |
| Gym scenarios become stale as regression tests | Low | Model capability only increases; ceiling scenarios stay ceiling |
| We missed a mechanism the gym could have found | Low | 85 experiments with systematic coverage; diminishing returns are real |

## Summary

The gym taught us that **structural interventions change behavior and text interventions don't**. That finding — replicated across 85 experiments with overwhelming consistency — is the contribution. The specific mechanisms (externalization at +74pp, few-shot at 100%, workflow gates at 100%) are ready for production. The gym is not the place to test them further. Graduate it.
