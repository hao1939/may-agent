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
**Evidence**: KE-002 (0/32+ experiments), KE-009 (0/8 negative examples), KE-025 (external validation from DD-537), DD-731 (capability doesn't predict cooperation — explicit protocols needed, not instructions)

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
**Evidence**: KE-007 (56+ experiments), KE-031 (+69pp aggregate), KE-094 (-57pp laziness), DD-731 (explicit protocols double cooperation performance; structural mechanism not prompt-based)

Interventions that change the agent's execution sequence — not its instructions — are the only reliable mechanism. Three structural types work:

| Type | Mechanism | Effect Size | Evidence |
|------|-----------|-------------|----------|
| **Forced Externalization** | Write judgment artifact → gate → act | +69pp (17/17 = 100%) | KE-031, 5 scenarios, 3 failure domains |
| **Workflow Enforcement** | Phase 1 (assess) → Phase 2 (act) | +50-87pp | KE-007, 6 promoted experiments |
| **Infrastructure Constraints** | Environment blocks bad behavior | -57pp laziness (58% → 1%) | KE-094, 862 commits measured |

**Unifying mechanism**: All three work by restructuring **when** the agent thinks relative to **when** it acts. They don't add information — they add temporal sequencing. The agent already knows the right answer (KE-031: agents produce 8,000-10,000 character analyses showing deep understanding when forced to externalize). The default behavior suppresses this latent capability.

### Law 3: Agent Attention Is Zero-Sum
**Evidence**: KE-025 (instruction overhead paradox), KE-064 (execution crowding), KE-027 (skill ablation shows 0 effect), DD-733 (DACS: context pollution from N agents degrades steering to 21-60%; isolation restores 90-98.4%)

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
**Evidence**: KE-052 (unified thesis across 3 domains, r=0.81 for RIFT prediction), DD-732 (conformal calibration of verification outputs matters more than individual verifier accuracy — selection effect achieves +22pp)

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

## Part 6: Multi-Agent Extension — The Cooperation-Calibration-Context Triad

**Added**: 2026-04-10 (DD-731, DD-732, DD-733 integration — see KE-120 for full synthesis)

Three independent papers from a single arXiv drop validate and extend Laws 1, 2, 3, 5 in the multi-agent domain:

| Paper | Finding | Law Validated | Extension |
|-------|---------|---------------|-----------|
| DD-731 (Yadav et al., ICLR 2026) | o3 at 17% collective vs o3-mini at 50% — capability ≠ cooperation | Laws 1, 2 | Structure (explicit protocols) works; instructions/capability don't |
| DD-732 (Wang et al.) | 81.9% wrong-consensus intercepted by conformal prediction | Law 5 | Calibration architecture > verifier quality |
| DD-733 (Patel) | 90-98.4% accuracy with context isolation vs 21-60% flat | Law 3 | Attention zero-sum applies to multi-agent context with amplified force |

**Key insight**: The Five Laws apply with **amplified force** in multi-agent settings. The N-agent multiplier makes every violation worse. This constitutes a 6th external validation group for the theory (previous 5: SkillsBench, ETH Zürich, DD-537, DD-706, DD-688).

---

## Part 7: External Validation

**Added**: 2026-04-11

The Five Laws have now received substantial external validation from the academic literature. Across 50+ external papers, 6 independent research groups, and ~30,000 evaluations, the core findings hold:

### Validation Sources

| Source | What It Validates | Scale |
|--------|-------------------|-------|
| **CR-325** (Five Laws External Validation) | First systematic mapping of external literature to all 5 Laws. Each law validated by 2-5 independent papers. SkillsBench (7,308 trajectories): AI-generated skills average -1.3pp. ETH Zürich: instruction overhead +20% cost, -completion. | 15+ papers, ~10K evaluations |
| **CR-336** (External Literature Validation Map) | Capstone meta-synthesis mapping 90+ deep dives (DD#655-743) and 19 cross-references (CR#317-335) against the Three-Mechanism Theory. All 5 Laws validated by 3-5+ independent sources each. All 3 mechanisms (M1/M2/M3) validated by 5+ papers each. Novel contributions identified: three-mechanism decomposition (KE-060), diagnostic decision tree, creative inference gap (KE-126). | 90+ papers, ~15K evaluations |
| **CR-339** (Week in Review Capstone) | Structure All the Way Down — synthesizes 88 DDs + 20 CRs across 5 convergence streams. Confirms structure > content across all streams. 3 breakthroughs (creative inference gap, constraint paradox hump curve, multi-agent amplification). | Full corpus synthesis, ~30K cumulative evaluations |

### Validation Summary by Law

| Law | External Support | Confidence |
|-----|-----------------|------------|
| Law 1 (Text rules fail) | SkillsBench (-1.3pp, N=7,308), DD-537 (ETH Zürich), DD-731 (capability ≠ cooperation) | Very High |
| Law 2 (Structure works) | DD-731 (protocols double cooperation), DD-732 (calibration architecture), 5+ M1/M2/M3 papers | Very High |
| Law 3 (Attention zero-sum) | DD-733 (DACS: context pollution → 21-60%), DD-537 (instruction overhead +20% cost) | Very High |
| Law 4 (Explicit wiring required) | DD-706 (capability discovery ~0%), SkillsBench (skill availability ≠ skill use) | High |
| Law 5 (Access > content) | DD-732 (conformal calibration > verifier quality), CR-336 (RIFT prediction validated) | Very High |

**Bottom line**: The Five Laws are no longer just internal empirical findings — they are externally validated theoretical principles with convergent support from 6+ independent research groups across ~30K evaluations. No contradictory evidence has been found.

---

## Part 8: Post-Publication Updates (2026-04-11)

**Added**: 2026-04-11 — Major theoretical advances since initial publication.

### Update 1: Attention Channel Theory Provides Mechanism for Laws 1-3 (H-098)

The Five Laws described *what* works and doesn't. H-098 (Attention Channel Theory) now explains *why* through a three-channel model:

| Channel | Mechanism | Effectiveness | Maps to |
|---------|-----------|---------------|---------|
| **Ch1** (Text instructions in system prompt) | Competes with task-execution tokens in same attention stream | **0%** on judgment (N=32+) | Law 1 |
| **Ch2** (Environmental state — file artifacts, workflow gates) | Structurally separate from text generation | **87-100%** (KE-031: 17/17) | Law 2 |
| **Ch3** (Task-message positional privilege) | Positional priority in attention, but task-type dependent | **0-100%** (varies by task type) | Between Laws 1-2 |

**Direct experimental test (EXP-127)**: Same content, same agent, same task — only channel varied:
- Ch1 (in SOUL.md): 0/6 (0%) ✅ predicted
- Ch2 (in workflow gate): 6/6 (100%) ✅ predicted  
- Ch3 (in task message): 0/6 (0%) ❌ predicted 83-100%

**Follow-up (EXP-128)**: Ch3 content variants (response-only, detection-enhanced, detection-only) all 0/6 — confirms mechanism is positional, NOT content quality. This is why Law 5 (access > content) works: you're switching channels, not improving content.

**Implication**: Law 1 and Law 2 are not about "text vs. structure" — they're about channel separation. Ch1 interventions fail because they compete with task execution in the same processing stream. Ch2 interventions succeed because they operate in a structurally separate channel. This explains the categorical (not gradual) gap.

### Update 2: Discovery Task Boundary — A Fundamental Limit (H-099)

**All channels fail on discovery tasks.** This is the strongest limit we've found:

| Intervention | Channel | Effect on Discovery | N |
|-------------|---------|--------------------|----|
| Forced checklist (EXP-117) | Ch1 | **-67pp** (harmful) | 12 |
| Progressive tracking (EXP-120) | Ch1 | **-50pp** (harmful) | 12 |
| Time budget (EXP-121) | Ch1 | +16pp (NS) | 6 |
| Environmental hints (EXP-122, 126) | Ch2 | **NULL** (0pp) | 30 |
| Structural Phase 0 (EXP-124) | Ch2 | **NULL** (0pp) | 12 |
| Few-shot examples (EXP-130) | Ch3 | **-67pp** (harmful, p=0.030) | 12 |

**7 experiments, 6 intervention types, 3 channels — all fail or harm.** Discovery tasks (requiring creative inference about *what* to do, not executing a known task) represent a fundamental boundary. The mechanism is "template displacement": any structured intervention constrains the search space, but discovery requires open-ended search. The "Paradox of Scaffolding Discovery": effective scaffolding requires knowing the target structure, but discovery IS the process of finding the target structure.

**This updates Part 4 Frontier 3**: Few-shot scaling is now partially resolved — few-shot works for behavioral tasks (100%, EXP-095) and fails/harms on analytical+discovery tasks. The task-type boundary is the key variable, not sample size or example quality.

### Update 3: Agent-Specific Calibration — Universal ≠ Optimal (H-095, EXP-142)

Law 2 ("structural interventions work") needs a critical qualification: **the same structural intervention can help some agents and harm others.**

Evidence from EXP-123 (production verification-depth guard):

| Agent | Quality WITH Guard | Quality WITHOUT Guard | Guard Effect |
|-------|-------------------|----------------------|-------------|
| QA | 94% | 17% | **+76.7pp** (guard-dependent) |
| Coach | 98% | 81% | **+17.3pp** (guard-dependent) |
| **Bob** | **74%** | **80%** | **-6.1pp** (guard-harmed) |

**EXP-142** (DEPLOYED, measuring): Tests whether exempting Bob from FM-3.3 verification-depth guard improves his quality. The guard creates false positives on Bob's git-commit patterns, triggering unnecessary verification that displaces productive work.

**Principle**: Structural interventions are still the right class, but they must be agent-calibrated. A 15x variance in effectiveness across agents means universal deployment is suboptimal. This extends Law 2 into: **"Agent-specific structural interventions reliably change behavior; universal structural interventions may help, harm, or be neutral depending on the agent's existing architecture."**

### Update 4: Workflow Adoption as Internalization Mechanism (H-101/H-102)

How do some agents "learn" from guards while others remain permanently dependent? The answer is **workflow adoption** — not behavioral learning:

- **"Learner" agents** (bob, coach, tech-lead): Have workflow-level verification phases in their prompts. Guard rates decline over time (72%→10%).
- **"Reliant" agents** (may, scout, optimizer): Lack workflow-level verification phases. Guard rates escalate (11%→76%).
- **Correlation**: 1.0 — workflow adoption perfectly predicts learner/reliant classification across all 6 agents.

**May's Paradox**: May has the MOST verification text (by word count) and the HIGHEST base quality — but the WORST guard block rate (71%). This proves text (Ch1) ≠ architecture (Ch2). May "knows" how to verify but doesn't do it until structurally forced.

**Mechanism**: "Internalization" is actually Ch2 architectural substitution. Learner agents already have verification workflow steps that duplicate what the guard checks. The guard becomes redundant (→ declining rate). Reliant agents lack these steps, so the guard remains essential (→ escalating rate as tasks get harder).

**EXP-139** (DEPLOYED): Tests whether adding verify-wrap workflow to optimizer converts it from "reliant" to "learner" — predicted ≥20pp FM-3.3 reduction.

### Update 5: Revised Intervention Hierarchy

The Four-Tier hierarchy from Part 2 needs refinement with Channel Theory:

| Tier | Channel | Mechanism | Effect Range | Agent-Specific? |
|------|---------|-----------|--------------|-----------------|
| 0 (Discovery) | Any | Template displacement | **NULL to HARMFUL** | N/A — universal failure |
| 1 (Text/Prompt) | Ch1 | Attention competition | **0%** on judgment | No — universally 0% |
| 1.5 (Few-Shot) | Ch3 | Positional privilege | **0-100%** | Yes — task-type dependent |
| 2 (Workflow) | Ch2 | Architectural substitution | **67-100%** | **Yes — agent-calibrated** |
| 3 (Infrastructure) | Ch2 | Environmental constraint | **87-100%** | Moderate — agent variation exists |
| 4 (Guard/Gate) | Ch2 | Forced gate-keeping | **87-100%** | **High — 15x agent variance** |

**Key additions**:
- **Tier 0** for discovery tasks (previously unrecognized category)
- **Tier 1.5** for few-shot (works on behavioral via Ch3, fails on analytical/discovery)
- **Agent-specificity column** recognizing that higher tiers need calibration

---

## Cross-References

**Foundational**: KE-002, KE-007, KE-020, KE-025, KE-031, KE-052
**Mechanisms**: KE-029, KE-034, KE-038, KE-059, KE-064, KE-065
**Verification**: KE-093, KE-097, KE-099, KE-100
**Infrastructure**: KE-094
**Multi-Agent Extension**: KE-120, DD-731, DD-732, DD-733
**Channel Theory**: H-098, KE-131, KE-132, KE-133 (EXP-127/128/130)
**Discovery Boundary**: H-099, KE-125, KE-126, KE-128, KE-131, KE-132, KE-133
**Agent-Specific Calibration**: H-095, H-101, H-102, KE-113, KE-115, KE-137, EXP-142
**External Validation**: CR-325, CR-336, CR-339
**Methodology**: KE-027 (ablation imperative), KE-052 (RIFT evaluation)
**Hypotheses**: H-085, H-091, H-093, H-094, H-095, H-098, H-099, H-101, H-102

## Tags
`meta-analysis`, `synthesis`, `intervention-hierarchy`, `forced-externalization`, `few-shot`, `structural-vs-text`, `theory`, `external-validation`, `channel-theory`, `discovery-boundary`, `agent-specific-calibration`
