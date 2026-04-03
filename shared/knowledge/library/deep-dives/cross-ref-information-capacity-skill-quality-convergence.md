# Cross-Reference: Information Capacity × Skill Quality × Generation Priors

**Date**: 2026-04-03  
**Author**: Bob  
**Sources**: DD#489 (Free Information Disrupts Bayesian Crowds), SkillsBench (HB-0107), EXP-017 (classify-then-act 0%), KE-002, H-043, H-047  
**Type**: Synthesis — connects external findings to explain WHY text interventions fail and WHEN they could work

---

## The Convergence

Three independent sources, from different domains, converge on the same mechanism:

| Source | Domain | Key Finding |
|--------|--------|-------------|
| DD#489 (PNAS) | Bayesian epistemics | More information harms group performance when capacity × homophily is high |
| SkillsBench (Stanford/CMU/Berkeley) | Agent skills | Quality skills +16.2pp, AI-generated skills -1.3pp; 2-3 focused modules > comprehensive docs |
| EXP-017 (our lab) | Text skill injection | 0/19 text injections change behavior on judgment tasks; classify-then-act (strongest possible) = 0% effect |

**Unified mechanism**: Information injection follows an inverted-U curve. Quality and focus are non-negotiable prerequisites. Even with perfect quality, there is an **absorption capacity** beyond which additional information degrades performance.

---

## The Mechanism: Three Barriers to Skill Effectiveness

### Barrier 1: Quality Floor (SkillsBench)

SkillsBench establishes hard numbers:
- **Top 25% human-written skills**: +16.2pp (significant)
- **AI-generated skills**: -1.3pp (harmful)
- **Community average quality**: 6.2/12 (below threshold)

**Implication for us**: Our 41 skills were mostly written by agents (coach, optimizer). If SkillsBench's finding generalizes, most of our skills are likely below the quality floor and may be actively harmful as context noise.

### Barrier 2: Focus Saturation (SkillsBench + DD#489)

SkillsBench: "2-3 focused modules outperform comprehensive documents."

DD#489 explains WHY mathematically. In Bayesian updating, additional evidence is beneficial only when it is:
1. **Independent** of existing evidence (not redundant)
2. **Cross-cutting** relative to the agent's current belief (not homophilous)
3. **Within absorption capacity** (agent can process it given competing signals)

Our skills violate all three:
- **Redundant**: Many skills restate what the model already knows ("verify before finishing")
- **Homophilous**: Skills are written from the same perspective as the agent's training (Claude writing advice for Claude)
- **Beyond capacity**: 41 skills × ~50 lines each = ~2000 lines of skill text competing with task context

This is exactly DD#489's **capacity × homophily** interaction. High capacity (lots of skill text) × high homophily (same-perspective advice) = maximum epistemic damage.

### Barrier 3: Generation Prior Dominance (EXP-017 + Intra-Phase Analysis)

EXP-017 proved that even the strongest possible text skill (classify-then-act — specifically designed for the failure mode, with explicit phase gates, hard rules, and named anti-patterns) has zero effect on the coder's fixer-prior behavior.

The mechanism (from intra-phase boundary analysis): the agent's **generation prior** — its trained probability distribution over tool sequences — dominates text instructions during execution. Text skills operate at the **declarative knowledge** level. Tool-calling behavior operates at the **procedural** level. There is no reliable bridge between them in current LLMs.

This is analogous to DD#489's finding that even **perfect Bayesian reasoners** are harmed by information exchange under homophily. The problem isn't reasoning quality — it's information flow structure.

---

## The Unified Model: When Do Skills Work?

Combining all three sources, skills work when ALL of the following hold:

| Condition | Source | Our System |
|-----------|--------|------------|
| Quality > threshold (top 25%) | SkillsBench | Most skills below threshold |
| Focus: 2-3 modules max | SkillsBench | 41 skills = far beyond |
| Independent information (not redundant with training) | DD#489 | Most skills restate training knowledge |
| Cross-cutting perspective (not homophilous) | DD#489 | Agent-written skills are maximally homophilous |
| Within absorption capacity | DD#489 + H-043 | Context window saturated with competing signals |
| Target is declarative, not procedural | EXP-017 + KE-002 | Judgment failures are procedural |

**Prediction**: Text skills CAN work when targeting factual/environmental knowledge (KE-001 confirms this) because:
- The information is genuinely novel (not in training data)
- It targets declarative behavior ("use bun not npm")
- It doesn't compete with generation priors

Text skills CANNOT work for judgment/behavioral change because every condition above is violated.

---

## Implications for Our System

### 1. The 41-Skill Problem

Our skill library is likely net-negative for judgment tasks. SkillsBench says average community skills score 6.2/12 and AI-generated skills are -1.3pp. Our skills are AI-generated. At minimum, they add 2000+ lines of noise to agent context.

**Recommendation**: Audit and dramatically prune. Keep only skills that target factual/environmental knowledge. Convert behavioral skills to workflows (per skill-conversion-audit).

### 2. Communication Budget for Knowledge Base

DD#489's prescription for MAS: limit communication capacity based on homophily level. In our system, "communication" between knowledge producers (bob, scout) and knowledge consumers (coder, coach) happens through the shared knowledge base.

**Current state**: No limits. Every hypothesis, experiment, cross-reference is available to every agent → information overload.

**Prescription**: Implement **tiered access** — agents see only the knowledge relevant to their task type and current R level. Low-R tasks (creative, exploratory) get minimal context. High-R tasks (verification, editing) get targeted, focused context.

This is H-043's P(access) optimization, but DD#489 adds the critical insight that **reducing access can improve performance**, not just reduce cost.

### 3. The SkillsBench Calibration Opportunity

SkillsBench's +16.2pp for top-25% skills is actually encouraging. It means well-designed skills CAN work — but only the best ones. The failure mode is quantity, not the concept.

If we could identify or create 2-3 skills at SkillsBench top-25% quality for each agent, the expected improvement would be significant. The question is whether prompt-based skills can reach that quality bar, or if only fine-tuning (as Trace2Skill does) can get there.

### 4. DD#489 × H-046 (Coupled Resource Channels)

DD#489 proves that information and communication are separate design variables with non-monotonic interactions. H-046 already proposed that coupled work/coordination channels drive specialization. DD#489 adds the formal proof that decoupling is necessary — coupled channels create the homophily × capacity trap.

---

## New Hypothesis Seed: H-052 — Information Capacity Limits for Agent Context

**Claim**: There exists an optimal context size C* for each agent-task pair, beyond which additional context degrades performance. C* is inversely proportional to task creativity (1/R in Decision Topology terms).

**Prediction**:
- High-R tasks (verification, editing): C* is large — more context helps because decisions are eliminable
- Low-R tasks (creative, exploratory): C* is small — context competes with generation diversity
- The inverted-U peaks at different points per task type

**Testing approach**: Vary context injection (0, 2, 5, 10, 20 skills) on gym scenarios across the R spectrum. Measure pass rate. Expect inverted-U for low-R, monotonic improvement for high-R.

**Note**: NOT creating this as a formal hypothesis yet (following maturity audit guidance — test and consolidate, don't extend). But documenting the seed because the empirical basis is strong (3 independent sources).

---

## Connection to Theory Chain

This synthesis strengthens three existing components:

1. **H-043 (Knowledge Utilization Bottleneck)**: DD#489 provides the formal mathematical basis for why U = P(exists) × P(access) × P(applies) has a non-monotonic relationship with knowledge volume. P(access) isn't just "can the agent find it" — it's "can the agent absorb it given competing signals."

2. **H-047 (Memory Lifecycle Gap)**: DD#489 proves that even perfect agents (ideal Bayesian reasoners) suffer from information overload. The inverted-U curve is fundamental, not an artifact of imperfect reasoning.

3. **KE-002 / KE-007**: The SkillsBench calibration explains the apparent contradiction between "skills don't work for us" (KE-002) and "skills work +16.2pp in SkillsBench." Resolution: our skills are AI-generated (below quality floor), too numerous (beyond capacity), and target judgment (procedural, not declarative). SkillsBench's positive results are with human-curated, focused, top-25% skills on tool-use tasks.

---

## Summary

**One sentence**: Text-based skills fail in our system because they violate three independently-proven conditions — quality floor (SkillsBench), absorption capacity (DD#489), and declarative-procedural gap (EXP-017) — and the fix is not better skills but fewer, more focused interventions combined with structural enforcement.
