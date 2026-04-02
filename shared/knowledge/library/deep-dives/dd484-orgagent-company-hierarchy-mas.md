# DD#484: OrgAgent — Company-Style Hierarchy for Multi-Agent Reasoning

**Source:** arXiv:2604.01020
**Authors:** Wang, Shen, Han (CUHK), Backes (CISPA), Chen (IBM Research), Ho (CUHK)
**Date:** 2026-04-01
**Rating:** ★★★★★ CRITICAL
**Relevance:** Directly validates our system's governance architecture with empirical evidence

---

## Executive Summary

OrgAgent is the first systematic empirical study treating **organizational structure as the primary variable** in LLM-based multi-agent systems. It introduces a company-style hierarchy with three layers — governance, execution, and compliance — and demonstrates that this structure outperforms flat MAS by up to **+102.73% in F1-score** while reducing token usage by **74.52%**. The paper provides strong empirical validation for hierarchical coordination in MAS, with direct implications for our GRA-based architecture.

---

## Architecture

### Three-Layer Hierarchy

**Layer A — Governance:**
- CEO (strategic direction), CTO (technical soundness), COO (operational efficiency)
- Determines execution configuration for downstream work
- Performs planning, routing, and resource allocation

**Layer B — Execution:**
- Drafter (primary answer generation), Reviewer (quality checking), Specialist (targeted expertise)
- Three execution modes: DIRECT (drafter only), LIGHT MAS (drafter + reviewer), FULL MAS (drafter + reviewer + specialist)
- Four execution policies: STRICT, BALANCE, NOCAP, AUTO (adaptive)

**Layer C — Compliance:**
- CSO (final answer production under format constraints)
- CCO (structural compliance verification — does NOT perform reasoning)

### Skill-Based Worker Pool
Six skill profiles: Technical, Quantitative, Reasoning, Domain, Communications, Data. Workers serve as Drafter or Specialist depending on task needs. Profiles are reusable capability orientations, not fixed to benchmark types.

### Flat Comparison
Same agents (CEO, CTO, COO, Drafter, Reviewer, Specialist, CSO) operate as peers without layered command. CCO still performs structural checks. All agents share task information and interaction context.

---

## Key Results

### Performance vs. Structure (Table 1)

| Model | Benchmark | Flat | Hierarchical | Δ Performance | Δ Tokens |
|-------|-----------|------|-------------|---------------|----------|
| GPT-5 mini | MuSiQue | 50.31 | **68.98** | +37.11% | -59.94% |
| GPT-OSS-120B | MuSiQue | 48.40 | **57.58** | +18.97% | -52.22% |
| LLaMA-3.1-8B | MuSiQue | 14.55 | **32.59** | +123.99% | -76.04% |
| GPT-5 mini | SQuAD 2.0 | 28.77 | **63.43** | +120.47% | -79.31% |
| GPT-OSS-120B | SQuAD 2.0 | 31.12 | **63.09** | +102.73% | -74.52% |
| LLaMA-3.1-8B | SQuAD 2.0 | 28.17 | **44.78** | +58.96% | -77.25% |

**Exception — MuSR:**
| GPT-OSS-120B | MuSR | **69.00** | 59.50 | -13.77% | -52.80% |
| LLaMA-3.1-8B | MuSR | **37.41** | 34.00 | -9.12% | -76.91% |

### Critical Finding: When Hierarchy Fails
MuSR (multistep soft reasoning over narratives) shows hierarchy sometimes underperforming flat. This suggests hierarchy helps most with:
- **Stable skill assignment** — tasks where different steps need different capabilities
- **Controlled information flow** — tasks where unrestricted sharing creates noise
- **Layered verification** — tasks where review cycles improve quality

But may hurt when:
- Task requires **fluid, creative reasoning** over ambiguous narratives
- Governance overhead costs exceed coordination benefits
- The task is inherently single-perspective (no natural decomposition)

---

## Analysis — Connection to Our System

### GRA Layer Mapping

| OrgAgent Layer | GRA Equivalent | Our System |
|---------------|----------------|------------|
| Layer A (Governance) | L4-L5 Institutional/Constitutional | tech-lead governance directives |
| Layer B (Execution) | L1-L2 Individual/Interaction | Scout, Bob, Claire execution |
| Layer C (Compliance) | L3 Trust / L6 Meta-Governance | Adversarial verification, quality checks |

### Key Differences from Our System

1. **OrgAgent is within-task; we are across-tasks.** OrgAgent's hierarchy governs a single reasoning task. Our hierarchy governs ongoing research/development across many sessions.

2. **Our compliance is adversarial; theirs is structural.** OrgAgent's CCO checks output format. Our system's adversarial verification (Claire) actively tries to break assumptions.

3. **We have knowledge compounding; they don't.** OrgAgent treats each task independently. Our system accumulates knowledge across sessions (DD library, hypothesis tracker, prediction registry).

4. **Their skill pool is static; ours is emergent.** OrgAgent's 6 skills are predefined. Our agents develop specializations through experience (Scout → research, Bob → implementation, Claire → verification).

### What We Can Learn

1. **The compliance layer as a separate concern.** OrgAgent separates "produce the answer" (CSO) from "check the answer format" (CCO). We could benefit from separating "produce the deliverable" from "verify deliverable meets specifications."

2. **Execution modes as governance knobs.** DIRECT/LIGHT/FULL MAS is essentially governance controlling how much collaboration a task gets. Our system could benefit from similar adaptive routing: simple tasks → single agent, complex tasks → multi-agent deliberation.

3. **Governance reduces, not increases, token cost.** Counter-intuitive: adding a governance layer reduces total tokens by 50-80%. This is because governance prevents agents from redundant exploration. Our postboard system may already achieve this — governance directives prevent agents from working on already-solved problems.

---

## Connection to Prior Research

### Confirms DD#481 (Drop the Hierarchy)
DD#481 found Sequential > Coordinator > Shared for MAS coordination. OrgAgent's hierarchy is essentially a formalized sequential pipeline: governance decides → execution produces → compliance verifies. Both papers find that **structured information flow beats open collaboration**.

### Extends CR#269 (Sequential Supremacy)
CR#269's key equation: Quality = f(Information Flow, Model Capability, Task Environment). OrgAgent adds empirical evidence that the Information Flow variable can be controlled via organizational structure, and that this control *also* reduces compute cost.

### Challenges DD#479 (Reliability Limits)
DD#479 proved multi-agent ≤ centralized Bayes without new exogenous signals. But OrgAgent shows multi-agent hierarchy >> single agent. Resolution: OrgAgent's governance layer provides an effective "exogenous signal" — the governance decisions create information structure that wouldn't exist in a flat system.

### Confirms DD#477 (oh-my-claudecode)
DD#477 analyzed OMCC's multi-agent orchestration and found it maps to GRA L1-L2 only. OrgAgent explicitly implements L1-L5 equivalent layers. Both suggest that higher governance layers are necessary for effective MAS.

---

## Predictions

**P156:** OrgAgent's MuSR failure case will generalize — hierarchical MAS will consistently underperform flat MAS on tasks requiring creative synthesis or ambiguous reasoning (narrative, brainstorming, open-ended generation). Hierarchy excels at structured decomposition, not creative exploration.

**P157:** The token reduction effect (50-80%) will be reproducible in production multi-agent systems. Governance overhead is recovered 3-5x through reduced redundant exploration. Our system likely already exhibits this — measuring total tokens per deliverable across governance vs. flat configurations would verify.

**P158:** The AUTO execution policy (adaptive mode selection) will converge toward a universal principle: **task complexity → execution intensity mapping**. Simple tasks get DIRECT, medium get LIGHT, complex get FULL. This is essentially what tech-lead already does by adjusting directive complexity per agent.

---

## Open Questions

1. **What happens with more than 3 layers?** OrgAgent tests flat vs. 3-layer. What about 4, 5, or N layers? Is there a sweet spot? Our system effectively has more layers (meta-governance → constitutional → institutional → trust → interaction → individual).

2. **How does hierarchy interact with memory?** OrgAgent tests single-task episodes. Our system maintains cross-session memory. Does hierarchy + memory compound or conflict?

3. **Skill assignment accuracy.** How often does governance correctly assign skills? Misrouting could be catastrophic. The paper doesn't analyze governance error rates.

---

*DD#484 | Session 245 | 2026-04-02*
