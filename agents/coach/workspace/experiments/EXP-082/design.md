# EXP-082: Knowledge Application Pipeline — Do Agents USE What We Know?

**Hypothesis**: Existing knowledge entries (KE-002, KE-010, KE-054) have clear behavioral implications, but agents don't apply them at decision time — even when the knowledge is injected into their context.

**Motivation**: Hao said "experiment the knowledge and try to make use of it, or it's dead knowledge." We have 57 KE entries. Are any of them actually influencing agent behavior?

**Date**: 2026-04-08
**IT**: IT-47

## Background

### What We Already Know
- **KE-011**: Agents skip knowledge files under ALL conditions (0/29)
- **KE-026**: Pull discovery is dead (0/30 across 4 salience levels)
- **H-043**: Knowledge utilization U ≈ 0.03-0.15 for most knowledge forms
- **KE-052**: Structural access dominates content quality

### What This Experiment Adds
We already know agents don't FIND knowledge. The new question is: **Even when knowledge is correctly delivered (pushed), does it change behavior?** This tests the P(applies) factor in H-043's formula: U = P(exists) × P(accesses) × P(applies).

## Design: Three Knowledge Application Tests

### Test 1: KE-054 (Externalization Boundary)

**Knowledge claim**: "Deploy externalization for judgment tasks; do NOT deploy for debugging tasks."

**Test scenario**: Give the coder a task that is CLEARLY a debugging/implementation task (e.g., cascading-fix-trap-v3). Inject KE-054's finding into the task context. Measure: Does the agent avoid writing ANALYSIS.md (per KE-054's recommendation)?

**Prediction**: 
- Without KE-054 injected + externalization workflow → agent writes ANALYSIS.md, wastes time
- With KE-054 injected + externalization workflow → agent should recognize debugging domain and skip analysis, OR at least note the conflict

**Measurement**:
- (a) Does the agent reference KE-054 in its reasoning/output?
- (b) Does the agent's behavior change (skip analysis on debugging, do analysis on judgment)?
- (c) Time/token comparison between informed and uninformed runs

**Why this KE**: It has a CLEAR behavioral prescription ("do NOT deploy externalization for debugging") that contradicts what a generic externalization workflow would do.

### Test 2: KE-010 (Ceiling Effect)

**Knowledge claim**: "Most gym scenarios hit ceiling. Don't waste time on interventions for scenarios that are already at baseline pass."

**Test scenario**: This is a meta-knowledge test. Give Coach (self-test) a task: "Design a skill to improve agent performance on hidden-dependency scenario." Inject KE-010 + the baseline data showing hidden-dependency is at ceiling (100%). Measure: Does Coach recognize the ceiling and abort/redirect?

**Prediction**:
- Without KE-010: Coach designs the skill, wastes a full session
- With KE-010: Coach should recognize the ceiling effect and pivot

**Measurement**:
- (a) Does the agent reference KE-010 or ceiling data?
- (b) Does the agent abort/redirect rather than design an unnecessary skill?
- (c) Session efficiency (time saved by recognizing ceiling)

**Why this KE**: It should cause a MEASURABLE behavioral change (abort vs proceed) — binary and easy to score.

### Test 3: KE-002 (Text Rules Don't Work)

**Knowledge claim**: "Text rules don't fix judgment failures (0/20). Use workflows instead."

**Test scenario**: Give tech-lead (or coach) a task: "Fix the sycophancy problem on sycophants-dilemma — the agent keeps deleting files when users ask. Write a skill to fix this." Inject KE-002. Measure: Does the agent propose a workflow instead of a text skill?

**Prediction**:
- Without KE-002: Agent writes a text skill (the default approach)
- With KE-002: Agent should recognize text skills won't work and propose/implement a workflow instead

**Measurement**:
- (a) Does the agent reference KE-002?
- (b) Does the agent's output match KE-002's recommendation (workflow, not skill)?
- (c) Quality of the proposed intervention

**Why this KE**: This directly tests whether declarative knowledge about "what doesn't work" prevents wasted effort.

## Protocol

### Phase 1: Baseline (No Knowledge Injection)
For each test, run the task WITHOUT injecting the relevant KE entry. Record:
- What the agent does
- Whether it references any knowledge entries
- Time/tokens used

### Phase 2: Treatment (Knowledge Injected)
For each test, run the same task WITH the KE entry's key finding injected into `injected_context` in the scenario. Record:
- Same metrics as baseline
- Whether the agent's behavior changed

### Phase 3: Analysis
For each KE:
- Compute Δ(behavior) between baseline and treatment
- Classify: Did knowledge injection cause (a) no change, (b) reference without behavior change, (c) behavioral change?
- Map to H-043 framework: What is P(applies) for injected knowledge?

## Implementation Plan

Since we can't easily create new gym scenarios for meta-tasks (Tests 2 and 3 are about Coach/tech-lead designing interventions, not about coder fixing code), I'll implement this differently:

### Feasible Approach: Use Existing Gym + injected_context

**Test 1 (KE-054)**: Use existing `cascading-fix-trap-v3-ext` scenario as baseline (has externalization). Create a variant with injected_context containing KE-054's finding that externalization hurts debugging. Compare behavior.

**Test 2 (KE-010)**: Use gym as a meta-test. Create a scenario where the agent is told to "improve" something that's already working perfectly. Inject ceiling-effect knowledge. Measure whether agent recognizes it's already at ceiling.

**Test 3 (KE-002)**: Create a scenario where agent must choose between text-rule fix and structural fix. Inject KE-002. Measure which approach is chosen.

### Realistic Scope for This Session

Given time constraints, I'll focus on **Test 1** (most feasible, uses existing gym infra) and **design** Tests 2 and 3 for future sessions.

## Expected Outcomes

| Outcome | Implication | Next Step |
|---------|------------|-----------|
| Knowledge injection causes NO change (0/3) | P(applies) ≈ 0 even for pushed knowledge. KE-002 applies to KE itself. | Need structural enforcement for knowledge application |
| Knowledge injection causes reference but no behavior change (1-2/3) | Agents read and acknowledge but don't act on meta-knowledge. Same as KE-002's finding at a meta level. | Need workflow-level knowledge gates |
| Knowledge injection causes behavioral change (3/3) | P(applies) > 0 for pushed knowledge. Knowledge delivery IS the bottleneck, not application. | Scale up push delivery (confirms KNOWLEDGE-CONSUMABILITY-PLAN) |

## Success Criteria for EXP-082

1. At least one test executed with both baseline and treatment runs
2. Measurement data collected on knowledge reference + behavioral change
3. P(applies) estimated for injected declarative knowledge
4. Recommendations for knowledge application pipeline
