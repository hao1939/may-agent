# CR#237: W12→W13 Research Roadmap — Gap-Targeted Research Agenda

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL (Strategic)  
**Date:** 2026-03-18  
**Source:** W12 Final Capstone gaps + full DD/CR corpus analysis  

---

## Purpose

The W12 Final Capstone identified 5 critical gaps in the four-stack agent systems architecture. This document converts those gaps into **actionable research targets** with specific arXiv search queries, paper signatures to watch for, and success criteria. The goal: when new batches drop in W13, triage can be done in minutes, not hours.

---

## Gap 1: No L4 Evolutionary Defense Exists

### The Problem
Deception as ESS (DD#273) shows agents converge on deception under competitive pressure regardless of initial alignment. DRCB (DD#419) defends at representational level; Colosseum (DD#222) at behavioral level. But **evolutionary drift** — slow, population-level convergence toward adversarial strategies — has no defense. This is the deepest, most dangerous attack layer.

### What We Need
A defense that monitors **population-level behavioral statistics over evolutionary time**, not individual agent actions in real-time. Must detect:
- Slow drift in cooperation rates across generations
- Evolutionary stable strategies that exploit cooperative norms
- Cultural transmission of deceptive heuristics through agent reproduction/training

### Paper Signatures to Watch
- Keywords: "evolutionary stability" + "multi-agent" + "defense/safety/alignment"
- Keywords: "population dynamics" + "LLM agents" + "deception detection"
- Keywords: "cultural evolution" + "agent alignment" + "drift"
- Any paper citing both Ghaemi 2025 (steganographic collusion taxonomy) AND evolutionary game theory
- Any paper that applies phylogenetic analysis or cultural evolution metrics to agent populations

### arXiv Search Queries (W13)
```
ti:"evolutionary" AND ti:"agent" AND (abs:"safety" OR abs:"alignment" OR abs:"deception")
ti:"population" AND ti:"multi-agent" AND abs:"drift"
abs:"evolutionary game" AND abs:"language model" AND abs:"defense"
abs:"cultural evolution" AND abs:"agent" AND abs:"alignment"
```

### Success Criteria
Paper proposes mechanism that detects behavioral drift across agent generations with lead time > 1 generation. Even partial solutions (e.g., drift detection without intervention) would be ★★★★★.

### Nearest Prior Work
- DD#273 (Evolving Deception): Defines the problem
- DD#419 (DRCB): Solves a subset (representational, real-time)
- DD#361 (Control-Theoretic Foundation): Formal stability framework that could be extended
- CR#207 (Agency-Stability Inverse): Theoretical backbone

---

## Gap 2: Cross-Stack Attack Vectors

### The Problem
Each stack (Security/Governance/Runtime/Memory) defends against single-stack attacks. But attacks that **traverse stacks** are undefended. Example cascade:
1. ClawWorm compromises agent config (Security layer breach)
2. Compromised agent feeds poisoned experiences to Atlas compilation (Memory layer attack)
3. Poisoned compiled memories generate bad governance rules via MAC (Governance layer corruption)
4. Corrupted rules are served via Helium to all agents (Runtime layer propagation)

No paper has addressed multi-layer cascade attacks in MAS.

### What We Need
- Attack papers that demonstrate cross-stack exploitation chains
- Defense papers that provide cross-layer integrity verification
- Formal models of attack surface composition (how do attack surfaces multiply across stacks?)

### Paper Signatures to Watch
- Keywords: "cascading" + "attack" + "multi-agent" + ("supply chain" OR "pipeline")
- Keywords: "cross-layer" + "security" + "agent" + "propagation"
- Keywords: "attack graph" + "LLM" + "agent"
- Any paper that combines memory poisoning with downstream behavioral corruption
- Any paper modeling attack surface as a DAG across system components

### arXiv Search Queries (W13)
```
abs:"cascading attack" AND abs:"multi-agent"
abs:"supply chain" AND abs:"agent" AND abs:"poisoning"
abs:"cross-layer" AND abs:"security" AND (abs:"LLM" OR abs:"agent")
abs:"attack propagation" AND abs:"multi-agent"
ti:"attack graph" AND abs:"agent"
```

### Success Criteria
Paper demonstrates or formally models an attack that traverses 2+ architectural layers. Even theoretical analysis without empirical demonstration would be ★★★★.

### Nearest Prior Work
- DD#421 (ClawWorm): Demonstrates infrastructure-level attack with memory persistence
- DD#424 (DynaTrust): Partial — detects compromised agents but doesn't trace cross-stack propagation
- CR#152 (Safety Monitoring Stack): Layers defined but cross-layer integrity not addressed

---

## Gap 3: The Scalability Question

### The Problem
Do the four stacks scale monotonically with system size?
- CGAE proves monotonic safety scaling (Theorem 3) — ✅ within its formalism
- Helium shows linear speedup — ✅ for runtime
- REDEREF shows sublinear regret — ✅ for routing
- But SCCAL's geometric monitoring (ORC curvature computation) has unknown complexity at 1000+ agents
- DRCB's observer pool may not scale (moving target defense with 8 observers for 3 agents — what about 1000?)
- DynaTrust's trust graph: O(n²) edges for n agents

### What We Need
- Scalability analysis of safety/monitoring systems for large-scale MAS (>100 agents)
- Approximation algorithms for geometric/statistical monitoring that maintain detection quality
- Empirical studies of MAS at scale (most current work: 2-10 agents)

### Paper Signatures to Watch
- Keywords: "scalable" + "multi-agent" + ("monitoring" OR "safety" OR "trust")
- Keywords: "large-scale" + "multi-agent" + "coordination"
- Any paper evaluating MAS with >50 agents on safety metrics
- Any paper proposing hierarchical/distributed monitoring for MAS

### arXiv Search Queries (W13)
```
ti:"scalable" AND abs:"multi-agent" AND (abs:"safety" OR abs:"monitoring")
abs:"large-scale" AND abs:"multi-agent" AND abs:"trust"
abs:"hierarchical monitoring" AND abs:"agent"
ti:"scaling" AND abs:"multi-agent reinforcement learning" AND abs:"safety"
```

### Success Criteria
Paper provides empirical or theoretical scalability bounds for a safety/monitoring mechanism at >50 agents. Sub-quadratic algorithms for trust or monitoring would be ★★★★★.

### Nearest Prior Work
- DD#400 (Seven Laws): Law 3 (Dynamic Topology) implies scaling challenges
- DD#412 (SCCAL): Core mechanism needs scaling analysis
- DD#425 (CGAE): Only paper with formal scalability theorem
- DD#338 (Science of Scaling): Empirical scaling laws for agent collectives

---

## Gap 4: Memory Adversarial Robustness

### The Problem
Atlas's three-step verification gate (dedup τ_d=0.92, LLM verification, lexical grounding k_min=2) was tested only for quality, never adversarially. Can a sophisticated attacker craft experiences that:
1. Pass deduplication (sufficiently novel)
2. Pass LLM verification (semantically plausible but subtly wrong)
3. Pass lexical grounding (contain real keywords from context)
4. Yet inject false behavioral modifications into the compiled prompt?

This connects to ClawWorm's demonstrated memory contamination persistence (1.00).

### What We Need
- Adversarial evaluation of memory compilation/distillation systems
- Backdoor attacks against agent memory systems
- Defenses for experience poisoning in agent learning

### Paper Signatures to Watch
- Keywords: "memory poisoning" + "agent" + ("backdoor" OR "adversarial")
- Keywords: "experience replay" + "poisoning" + "agent"
- Keywords: "prompt injection" + "memory" + "agent"
- Any paper that tests a memory system against adversarial inputs
- Any paper on backdoor attacks against self-improving systems

### arXiv Search Queries (W13)
```
abs:"memory poisoning" AND (abs:"agent" OR abs:"LLM")
abs:"backdoor" AND abs:"agent memory"
abs:"experience poisoning" AND abs:"reinforcement learning"
abs:"adversarial" AND abs:"compiled" AND abs:"memory"
ti:"poisoning" AND abs:"multi-agent"
```

### Success Criteria
Paper demonstrates successful or unsuccessful attack against an agent memory system, or proposes a defense with formal guarantees. Even negative results (memory systems are robust) would be highly valuable.

### Nearest Prior Work
- DD#426 (Atlas): The target system — verification gate untested adversarially
- DD#421 (ClawWorm): Demonstrated memory contamination in OpenClaw
- DD#417* (Spectral Guardrails): Detection-side approach (attention analysis for hallucination)
- CraniMem: Neurocognitive write-gating (potential defense)

---

## Gap 5: The Human-in-the-Loop Threshold

### The Problem
The architecture assumes human governance at the top. MAC generates human-readable constitutions. CGAE produces auditable tier assignments. But:
- At what scale does human oversight become infeasible?
- What properties are lost when transitioning from human to automated governance?
- How do you verify that automated governance preserves the intent of human-authored rules?

### What We Need
- Formal models of human oversight scaling limits
- Architectures for graduated autonomy (human → semi-automated → automated governance)
- Alignment verification: does the automated constitution implement human intent?

### Paper Signatures to Watch
- Keywords: "human oversight" + "scalability" + "agent"
- Keywords: "graduated autonomy" + "multi-agent"
- Keywords: "alignment verification" + "constitution" + "agent"
- Keywords: "oversight" + "delegation" + "LLM"
- Any paper from MIRI, ARC, or Anthropic alignment team on MAS oversight

### arXiv Search Queries (W13)
```
abs:"human oversight" AND abs:"multi-agent" AND abs:"scalability"
abs:"graduated autonomy" AND abs:"agent"
abs:"alignment verification" AND abs:"constitution"
ti:"oversight" AND abs:"agent" AND abs:"delegation"
abs:"human-in-the-loop" AND abs:"multi-agent" AND abs:"governance"
```

### Success Criteria
Paper proposes mechanism for transitioning from human to automated oversight with formal guarantees about property preservation. Even theoretical analysis of the oversight scaling problem would be ★★★★.

### Nearest Prior Work
- DD#420 (MAC): Generates rules but human must validate
- DD#425 (CGAE): Formal governance but assumes human-set parameters
- DD#400 (Seven Laws): Law 6 (Human Controllability) — defines the requirement
- CR#160 (Safety Trilemma): Suggests fundamental tension

---

## W13 Session Protocol

### Daily Batch Triage (when new batch drops)
1. **Scan titles** against the 5 gap signature lists above
2. **Priority order:** Gap 1 (evolutionary) > Gap 2 (cross-stack) > Gap 4 (memory adversarial) > Gap 3 (scalability) > Gap 5 (HITL)
3. **Deep-dive threshold:** Any paper matching 2+ gap signatures → immediate deep-dive
4. **Quick triage:** Papers matching 1 gap signature → brief + papers.md entry

### Cross-Platform Monitoring
- **HuggingFace Papers:** Check for trending papers on evolutionary AI safety, multi-agent security
- **GitHub Trending:** Check for implementations of monitoring/safety tools for MAS
- **Semantic Scholar:** Track citations of ClawWorm, DRCB, Evolving Deception for follow-up work

### Synthesis Targets for W13
1. If Gap 1 paper found: Produce "Evolutionary Defense Architecture" synthesis
2. If Gap 2 paper found: Produce "Cross-Stack Attack Model" synthesis
3. If 3+ memory papers found: Produce "Memory Security Evaluation Framework"
4. Weekly: W13 Capstone integrating new findings into the four-stack architecture

---

## Priority Ranking (What Would Advance the Field Most)

| Rank | Gap | Impact | Likelihood of Paper in W13 | Our Readiness |
|------|-----|--------|---------------------------|---------------|
| 1 | Evolutionary Defense (Gap 1) | ★★★★★ | Low (6-12 month prediction) | High — DD#273/361/419 provide theoretical base |
| 2 | Cross-Stack Attacks (Gap 2) | ★★★★★ | Medium (attack papers tend to cluster) | High — full attack taxonomy ready |
| 3 | Memory Adversarial (Gap 4) | ★★★★☆ | Medium (active area) | High — Atlas/CraniMem deep-dives ready |
| 4 | Scalability (Gap 3) | ★★★★☆ | Medium-High (empirical papers common) | Medium — need to survey MARL scaling lit |
| 5 | HITL Threshold (Gap 5) | ★★★★☆ | Low-Medium (philosophical + technical) | Low — least developed in our corpus |

---

*CR#237 by Scout | Session 141 | 2026-03-18*
*Derived from: W12 Final Capstone (Part VI: Critical Gaps and Predictions)*
