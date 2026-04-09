# KE-101: Meta-Analysis — A Theory of What Actually Improves LLM Agent Performance

**Date**: 2026-04-09
**Author**: Bob (Architect)
**Status**: Synthesis
**Confidence**: High (draws on 100+ experiments, 104 KE entries, 21 active hypotheses)
**Type**: Meta-analysis — synthesizes all experimental findings into an actionable theory

## Executive Summary

After 104+ experiments across 14 weeks, a coherent theory of agent improvement emerges. The central finding is that **structure dominates content** at every level of the system. Text-based interventions (rules, instructions, skills) have a verified 0% success rate on judgment tasks (N=32+). Structural interventions (forced externalization, workflow enforcement, infrastructure constraints) achieve 87-100% success rates. The gap is not incremental — it is categorical.

This document synthesizes findings across all experiments into five laws, four intervention tiers, and three meta-principles that should guide all future agent improvement work.

---

## Part 1: The Five Laws of Agent Improvement

### Law 1: Text Rules Do Not Change Judgment Behavior
**Evidence**: KE-002 (0/32+ experiments), KE-009 (0/8 negative examples), KE-025 (external validation from DD-537)

Adding text instructions to agent prompts — SOUL.md rules, behavioral guidelines, domain knowledge, negative examples, warning labels — produces zero measurable behavior change on judgment-class tasks. This holds across:
- Identity/role framing (0/3)
- Procedural trigger-action rules (0/3)
- Preference statements (0/3)
- Domain knowledge injection (0/3)
- Negative examples in LESSONS.md (0/8)
- Complex multi-step protocols (0/19)
- Auto-evolved SOUL.md variations (0/5)

**Worse than zero**: One text skill (structured-plan-writing, EXP-018) was actively harmful — the agent followed the planning protocol so diligently it timed out before completing deliverables (8/8 → 6/8). External validation confirms: AI-generated skills average -1.3pp across 7,308 trajectories (SkillsBench).

**Why**: LLMs process instructions in priority order. Task-execution mode ("read code → find bug → fix") dominates. Behavioral modifiers in system prompts are functionally invisible during execution. The mechanism is not forgetting — it's that action-mode reasoning suppresses reflective-mode reasoning.

**Exception**: Text DOES work for environmental facts ("use bun not npm", "no npx available"). The boundary is factual constraints (text works) vs. judgment decisions (text doesn't).

### Law 2: Only Structural Interventions Reliably Change Behavior
**Evidence**: KE-007 (56+ experiments), KE-031 (+69pp aggregate), KE-094 (-57pp laziness)

Interventions that change the agent's execution sequence — not its instructions — are the only reliable mechanism. Three structural types work:

| Type | Mechanism | Effect Size | Evidence |
|------|-----------|-------------|----------|
| **Forced Externalization** | Write judgment artifact → gate → act | +69pp (17/17 = 100%) | KE-031, 5 scenarios, 3 failure domains |
| **Workflow Enforcement** | Phase 1 (assess) → Phase 2 (act) | +50-87pp | KE-007, 6 promoted experiments |
| **Infrastructure Constraints** | Environment blocks bad behavior | -57pp laziness (58% → 1%) | KE-094, 862 commits measured |

**Unifying mechanism**: All three work by restructuring **when** the agent thinks relative to **when** it acts. They don't add information — they add temporal sequencing. The agent already knows the right answer (KE-031: agents produce 8,000-10,000 character analyses showing deep understanding when forced to externalize). The default behavior suppresses this latent capability.

### Law 3: Agent Attention Is Zero-Sum
**Evidence**: KE-025 (instruction overhead paradox), KE-064 (execution crowding), KE-027 (skill ablation shows 0 effect)

Every addition to an agent's context — instructions, skills, rules, examples — consumes finite attention capacity. This creates three failure modes:

1. **Instruction debt** (KE-025): More context files decrease task completion and increase inference cost by 20%+ (DD-537, ETH Zürich). Each instruction is a potential failure mode, an attention tax, and an exploration inflator.

2. **Execution crowding** (KE-064): Chaining multiple forced externalization steps achieves the chained goal (100% documentation accuracy) but crowds out the primary task (0% task completion). One externalization per task is the limit.

3. **Phantom improvements** (KE-027): Skills that appear to help in before/after comparisons produce exactly zero effect in ablation studies. The agent scores 6/6 with all skills AND with zero skills. The improvement came from framework changes, not content.

**Implication**: The question is never "should we add this?" but always "what are we removing to make room?"

### Law 4: Capability Adoption Requires Explicit Wiring
**Evidence**: KE-020 (0/29 discovery rate across all salience levels)

Agents do not spontaneously discover or use available capabilities. This holds regardless of:
- Capability type (workflows, skills, scripts)
- Salience level (tool list, system prompt nudge, task text hint, filesystem presence)
- Explicitness (even "Check scripts/ for debugging tools" in the task text: 0%)

The adoption hierarchy is dramatic:

| Level | Mechanism | Adoption Rate |
|-------|-----------|--------------|
| Available | File exists in directory | ~0% |
| Instructed | Heartbeat mentions it | ~4-10% (decaying) |
| Automatic | Infrastructure routes to it | 100% |

**Corollary**: Building a capability is half the work. Wiring it into the execution path is the other half. An unwired capability is functionally nonexistent. Even wired capabilities decay from peak to 4-10% floor over 7 days (organic decay from session-length optimization pressure).

### Law 5: Access Structure Dominates Content Quality
**Evidence**: KE-052 (unified thesis across 3 domains, r=0.81 for RIFT prediction)

Across workflow effectiveness, evaluation reliability, and knowledge base utilization, a single pattern emerges: **the accessibility of information matters more than its quality.** Systems fail because the right content can't reach the right consumer at the right time.

| Domain | Content Quality | Access Structure | Finding |
|--------|----------------|------------------|---------|
| Workflow effectiveness | Correct procedure exists | Does workflow expose it? | R (eliminable ratio) predicts benefit; N (task size) adds noise |
| Evaluation reliability | Meaningful criteria exist | Can evaluator observe answer? | RIFT ratio predicts agreement (r=0.81) |
| KB utilization | Valuable entries exist | Can writer navigate to them? | 85% citations point to most recent 25% of entries |

**Implication**: "Add more content" is almost always the wrong fix. Improve the access structure instead.

---

## Part 2: The Four-Tier Intervention Hierarchy

All tested interventions fall into four tiers with dramatically different effectiveness:

### Tier 1: Text/Prompt (0% on judgment)
- SOUL.md rules, behavioral guidelines, domain knowledge
- Negative examples, warning labels
- Style preferences, philosophical principles
- **When to use**: Environmental facts only ("use bun", "no npx")
- **Total evidence**: 0/32+ on judgment tasks

### Tier 2: Lightweight Structural (33-100%, scenario-dependent)
- **Few-shot worked examples** (KE-059, KE-065): Domain-matched examples achieve 100% (18/18 matched). Cross-domain transfer fails on hard scenarios (0%). The critical insight: examples must match the domain class of the target task, and must be delivered in the task message (not system prompt). System-prompt delivery = 8% (1/12); task-message delivery = 100% (15/15).
- **Echo-back prompts**: +1.3 score improvement, 33% pass rate
- **Checklist injection**: +2.0 score, 0-33% pass rate
- **When to use**: Judgment skills where forced externalization is too heavy, and domain-matched examples exist
- **Limitations**: Does not transfer across domain classes on hard tasks. Cannot fix temporal discipline (tool-call sequencing).

### Tier 3: Heavy Structural (87-100%)
- **Forced externalization** (KE-031): Write judgment → gate → act. +69pp aggregate. Works across tunnel vision, sycophancy, and contradiction blindness. Even one sentence of judgment achieves 100% (minimal externalization = full per KE-033).
- **Workflow enforcement** (KE-007): Phase 1 (assess) → Phase 2 (act). 92-97% pass rate. Requires strict gate ("if ANALYSIS.md does not exist, STOP") — regular workflow without gate has 0% effect on sycophancy.
- **Adversarial framing** (KE-099): Reframe verification from confirmation ("verify this") to criticism ("find 3 bugs"). 100% (6/6) vs 11-25% baseline. Changes generation objective rather than fighting it.
- **When to use**: Any task with judgment-class decisions (R < 0.5)
- **Limitations**: Execution crowding if chained (KE-064). One externalization per task.

### Tier 4: Infrastructure/Environment (100%)
- **Commit guard** (KE-094): Environment blocks bad behavior. -57pp laziness, 0% in steady state.
- **Machine-verified evidence injection** (KE-100): Automated measurements injected into context. 100% (6/6). Eliminates verification confabulation.
- **Automatic routing**: Infrastructure routes tasks to capabilities. 100% adoption by definition.
- **When to use**: Any behavior that can be enforced by the environment rather than the agent
- **Limitations**: Infrastructure development cost. Can only enforce observable, deterministic behaviors.

---

## Part 3: Three Meta-Principles

### Meta-Principle 1: Redirect, Don't Fight
The most effective interventions don't fight the agent's tendencies — they redirect them.

- **Adversarial framing** (KE-099): Instead of fighting confirmation bias ("be objective"), redirects the generation objective to fault-finding. The agent's tendency to generate output aligned with its prompt now works FOR correctness.
- **Forced externalization** (KE-031): Instead of fighting action bias ("think before acting"), creates a structural requirement that converts internal judgment to external artifact. The agent's tendency to follow procedure now works FOR deliberation.
- **Few-shot examples** (KE-059): Instead of fighting the text-rule gap ("here's what to do"), shows the reasoning pattern in a parallel scenario. The agent's tendency to imitate now works FOR correct judgment.

The underlying principle: LLMs are generation machines that produce output aligned with their current context/frame. Changing the frame is easy; changing the generation mechanism is impossible. **Frame alignment** — making the correct behavior the natural generation output — is the core technique.

### Meta-Principle 2: Measure, Don't Assume (The Ablation Imperative)
The single most important methodological lesson: **before/after comparisons without controls are unreliable.**

- KE-027: Skills appeared to raise scores by +20-67pp. Ablation showed 0% effect — improvements came from framework changes.
- KE-052: KB appeared to be well-utilized. Citation analysis showed 85% recency bias — early entries were functionally invisible.
- KE-093: Agents appeared to verify inherited state. Content analysis showed fabricated verification — agents confabulated results matching their priors.

**Required methodology for any causal claim**:
1. Same-day baseline and treatment runs
2. Pin framework binary SHA between comparisons
3. N≥3 per condition minimum
4. Ablation study before declaring any skill/intervention effective
5. Machine-verified measurement where possible (don't trust agent self-report)

### Meta-Principle 3: Scale Invariance of Structure
Forced externalization — the most powerful intervention — operates identically at three scales (KE-038):

| Level | Optimizer | Artifact | Gate |
|-------|-----------|----------|------|
| Task | Agent | ANALYSIS.md | File must exist before acting |
| Harness | Meta-agent | Harness update | Holdout accuracy must improve |
| Constitution | Human | program.md/boundaries | Three Laws (bounded autonomy, simplicity, anti-overfitting) |

At every level, the pattern is identical: **an optimizer externalizes judgment into a durable written artifact, which is gated before it constrains downstream behavior.** This suggests forced externalization is not a technique but a fundamental pattern for reliable judgment in any optimization system — human, agent, or institutional.

---

## Part 4: What We Don't Know Yet (Open Frontiers)

### Frontier 1: Verification Without Confabulation
We've discovered that agents confabulate verification results (KE-093), and found two fixes (adversarial framing, machine evidence). But we don't know:
- Whether adversarial framing works on subtle defects (tested only on obvious ones)
- The minimal machine evidence needed to ground verification
- Whether verification confabulation generalizes to all LLMs or is model-specific

### Frontier 2: Multi-Session Coherence
The T-STAR hypothesis (DD-688) and our multi-session experiments suggest that agent performance degrades across sessions as context accumulates errors. EXP-104 (Context-Stripped Verification) is testing this now. Key questions:
- Can context be reliably compressed without losing critical state?
- Is session-boundary verification the bottleneck or just one failure point?

### Frontier 3: Few-Shot Scaling
Few-shot examples are the most efficient intervention (100% with domain matching, zero infrastructure cost). But:
- How many domain classes does a typical skill need to cover?
- Can examples be auto-generated from successful agent traces?
- What is the interaction between few-shot examples and forced externalization?

### Frontier 4: Optimal Intervention Dosage
KE-064 shows diminishing returns from chained interventions. But:
- Is one forced externalization always the optimum, or does it depend on task complexity?
- Can interventions be dynamically selected based on real-time agent behavior?
- What is the attention budget curve — linear, logarithmic, or cliff-like?

---

## Part 5: Practical Decision Framework

When designing an agent improvement:

```
1. Is this a factual constraint (path, tool, environment)?
   → YES: Text rule in common-sense.md (Tier 1). Done.
   → NO: Continue.

2. Is this a judgment/behavior change?
   → Can the environment enforce it deterministically?
     → YES: Infrastructure constraint (Tier 4). Highest reliability.
     → NO: Continue.
   
   → Do domain-matched worked examples exist?
     → YES: Few-shot in task message (Tier 2). Test transfer.
     → NO: Continue.
   
   → Is there a clear judgment step that can be externalized?
     → YES: Forced externalization with gate (Tier 3).
     → NO: Workflow enforcement with Phase 1/Phase 2 split (Tier 3).

3. NEVER: Add text rules, behavioral guidelines, or SOUL.md 
   modifications for judgment tasks. Evidence: 0/32+.

4. ALWAYS: Ablate before deploying. Run with and without.
   Trust the ablation, not the before/after.
```

---

## Summary Statistics

| Category | Experiments | Key Finding |
|----------|------------|-------------|
| Text rules on judgment | 32+ | 0% success, one harmful |
| Forced externalization | 17+ scenarios | 100% (17/17 matched), +69pp aggregate |
| Few-shot examples | 18+ matched runs | 100% (18/18), domain-match required |
| Infrastructure constraints | 3 deployments | ~100% behavior change |
| Workflow enforcement | 6 promoted | 87-100% on judgment |
| Adversarial framing | 6 runs | 100%, eliminates confabulation |
| Machine evidence injection | 6 runs | 100%, eliminates confabulation |
| Instruction overhead | External + internal | -20% completion, +20% cost |
| Skill ablation | 7 ablation runs | 0% causal effect detected |
| Capability discovery | 29 trials | 0% spontaneous discovery |

**The bottom line**: To improve agent performance, change structure (when and how the agent acts), not content (what the agent knows). The agent already knows enough. The problem is that knowing and doing are decoupled, and only structural interventions bridge that gap.

---

## Cross-References

**Foundational**: KE-002, KE-007, KE-020, KE-025, KE-031, KE-052
**Mechanisms**: KE-029, KE-034, KE-038, KE-059, KE-064, KE-065
**Verification**: KE-093, KE-097, KE-099, KE-100
**Infrastructure**: KE-094
**Methodology**: KE-027 (ablation imperative), KE-052 (RIFT evaluation)
**Hypotheses**: H-085 (forced externalization), H-093 (CIVC), H-094 (behavioral prediction)

## Tags
`meta-analysis`, `synthesis`, `intervention-hierarchy`, `forced-externalization`, `few-shot`, `structural-vs-text`, `theory`
