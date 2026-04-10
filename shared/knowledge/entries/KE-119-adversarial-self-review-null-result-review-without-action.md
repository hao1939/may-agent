# KE-119: Adversarial Self-Review Null Result — Review Without Action

**Date**: 2026-04-10
**Author**: Bob (synthesis of EXP-108 Phase 2 results)
**Status**: Verified
**Confidence**: High (N=18 gym runs, 3 scenarios × 2 arms × 3 reps)

## Core Finding

An adversarial self-review skill — a text prompt redirecting agents from "task executor" to "find 3 problems first" — produced **no significant treatment effect** in a controlled A/B gym experiment. Overall check pass rate: control 26.4% vs treatment 28.7% (+2.3pp, p >> 0.05). No scenario met the +15pp success threshold. The skill increased latency in 2/3 scenarios (+28%, +153%) with zero outcome improvement.

**The mechanism is "review without action"**: the skill made agents spend more time deliberating (visible in duration data) but this deliberation did not translate into better task execution. The agent performed a review step but couldn't convert review findings into corrective action.

## Evidence

### EXP-108 Phase 2 Results (18 runs)

| Scenario | FM Target | Control | Treatment | Delta | Duration Impact |
|----------|-----------|---------|-----------|-------|-----------------|
| phase-boundary-violation | FM-2.6 | 24.2% | 30.3% | +6.1pp | -23% (faster) |
| instruction-override-drift | FM-2.6 | 40.0% | 40.0% | +0.0pp | +28% slower |
| unresolved-failure-chain | FM-1.4 | 12.5% | 12.5% | +0.0pp | +153% slower |

### Key Observations

1. **Plan creation improved, execution unchanged**: In phase-boundary-violation, treatment created plans 3/3 vs 1/3 control — but plan quality and actual code fixes were identical (0/3 on auth/port fixes in both arms). The skill made the agent more deliberate in documentation without improving capability.

2. **Duration without benefit**: In unresolved-failure-chain, treatment added 92 seconds average (+153%) with zero check improvement. The adversarial review consumed time that could have been spent on the actual task.

3. **Identical outcomes on 2/3 scenarios**: instruction-override-drift and unresolved-failure-chain showed bit-for-bit identical pass rates — the skill had literally no effect on these tasks.

### Known Limitations

- **Agent mismatch**: Used Bob (architect) instead of coder (unregistered in binary). Bob may lack coding skills to fix these scenarios regardless.
- **Behavioral checks non-functional**: `--oneshot` mode produces 1-line JSON transcripts. All behavioral checks returned "No transcript available" in BOTH arms (systematic measurement issue, not treatment effect).
- **Skill injected only into Session 2**: Session 1 behavior identical between arms by design. If the skill would help most in Session 1 (e.g., phase boundary compliance), this wasn't tested.

## Theoretical Significance

### Strengthens KE-002 (Text Rules Don't Fix Judgment)

EXP-108's design explicitly argued that adversarial self-review is "structural text" (changes execution sequence) rather than "declarative text" (describes desired outcome), per KE-002's nuance section. The null result shows that **even structural text that changes the generation objective fails when delivered as a generic skill**. 

The EXP-103 finding (adversarial framing 100% on confabulation scenarios) does NOT generalize to non-confabulation failure modes. The mechanism was either:
- Specific to verification confabulation (FM-3.1/3.3) and doesn't transfer to FM-2.6/FM-1.4
- Confounded by evidence-over-narrative skill (as EXP-104 suspected)
- Only effective when tightly coupled to the decision context, not delivered as a generic skill file

KE-002's record is effectively extended: 0/35 declarative + 0/1 adversarial-structural on non-confabulation scenarios. The "structural text" subcategory that showed promise in EXP-084 (2/9 pass, Cohen's d > 3 score improvement) may be limited to specific narrow contexts.

### Aligns with KE-106 (Guards ≠ Training)

The skill didn't train or change the agent's underlying reasoning. The agent could be induced to spend more time reviewing (latency increase), but this review was disconnected from action — the agent lacked the capability to convert skepticism into corrective behavior. This parallels KE-106's finding that guards catch errors but don't train behavior.

### Aligns with KE-109/KE-110 (Gym Ceiling + Gym-Production Gap)

The Phase 1 results (all scenarios at ceiling for coder) showed the skill stack already solves these scenarios. Phase 2 (using Bob without skills) showed the adversarial skill alone can't substitute for the existing skill stack. This supports the KE-110 conclusion that the gym improvement loop is terminally complete.

### Connects to H-095 (Agent-Specific Interventions)

The skill was designed for multi-session context inheritance (FM-3.1/3.3) but tested on FM-2.6 (instruction following) and FM-1.4 (debugging). This is a mismatch between intervention design and test scenarios. H-095 predicts that interventions must match the agent's specific failure mechanism — adversarial self-review targets verification skipping, not instruction following or debugging capability.

## The "Review Without Action" Pattern

This result reveals a general pattern: **making an agent review more carefully is useless if the agent lacks the capability to act on its review findings**.

The adversarial skill successfully redirected the agent's generation objective — evidenced by:
- Longer durations (agent spent more time "thinking")
- Better plan creation (agent was more thorough in documentation)

But the downstream actions were unchanged because:
1. **Capability ceiling**: The agent couldn't fix `auth.js` hardcoded secrets or integrate the logger module regardless of how carefully it reviewed the problem
2. **Review-action disconnect**: Finding problems is a different skill from fixing them. The adversarial framing taught the agent to look for problems but didn't provide the execution capability to resolve them
3. **Generic vs. specific**: A generic "find 3 problems" prompt doesn't provide domain-specific knowledge about how to fix those problems

This distinguishes from the EXP-103 confabulation result where the review step DID lead to action: when the agent was told to "find 3 bugs in inherited work," it actually read files and discovered they were incomplete — and the action (not claiming completion) was simple. In EXP-108's scenarios, the action (fixing code, integrating logger modules) requires capability the agent didn't have.

## Predictions

- **P-119a**: Adversarial self-review delivered as a skill will show <5pp improvement on any non-confabulation gym scenario. (Tested and confirmed by EXP-108 Phase 2.)
- **P-119b**: Adversarial self-review MAY show improvement on FM-3.1/3.3 confabulation scenarios (where action = "don't claim false completion" rather than "fix the code"), but this is confounded with evidence-over-narrative per EXP-104.
- **P-119c**: Duration overhead from review-oriented skills will be >20% in scenarios where the review provides no actionable information.
- **P-119d**: Future text-based interventions targeting capability gaps (not judgment gaps) will show similarly null results — text can redirect attention but cannot create ability.

## Decision

**Do NOT promote adversarial-self-review skill to production.** The evidence shows:
- No statistically significant improvement on any tested scenario
- Increased latency in 2/3 scenarios (net harmful: time wasted on unproductive review)
- The skill addresses a different failure mode than what these scenarios test

Close this investigation line for skill-based adversarial delivery. Future adversarial approaches should:
1. Target FM-3.1/3.3 scenarios specifically (where "review → don't claim completion" is sufficient)
2. Be embedded in session context (not generic skill files), per EXP-104's confound finding
3. Be paired with capability-building interventions, not just orientation changes

## Connected Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-002 | Strengthened — adversarial-structural text also fails on non-confabulation scenarios |
| KE-099 | Bounded — adversarial framing works for confabulation but not general judgment |
| KE-106 | Parallel — review without action mirrors guards without training |
| KE-109 | Aligned — gym-production gap means gym skills solve gym-shaped problems only |
| KE-110 | Confirmed — gym improvement loop terminally complete; no new skill helps |
| H-093 | Informed — CIVC is not addressable by review orientation changes |
| H-095 | Counterevidence for universal interventions; supports agent-specific matching |
| EXP-103 | Bounded — adversarial framing effect doesn't generalize beyond confabulation |
| EXP-104 | Supported — confound concern validated; EXP-103 effect may be skill-driven |
| EXP-108 | Direct source (Phase 2 results) |
