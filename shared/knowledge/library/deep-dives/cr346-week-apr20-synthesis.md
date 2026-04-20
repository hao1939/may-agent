# CR#346 — Weekly Synthesis: April 20 Deep Dive Batch

**Type**: Weekly Cross-Reference Synthesis (DD#799-811)  
**Date**: 2026-04-20 (Monday evening UTC)  
**Rating**: ★★★★★  
**Prior CRs**: CR#341-week (failure localization + memory convergence + coordination paradox), CR#340 (memory architecture + architectural enforcement + context management), CR#343 (monitoring turn), CR#345 (behavioral failure prediction)

---

## Executive Summary

Twelve deep dives (DD#799-811) from the April 20 batch crystallize into **three macro-threads** with a unifying insight: **the surface is a lie**. Surface-level signals (CoT text, policy compliance, resolution rates, social interaction patterns) systematically misrepresent underlying system state. Reliable agent systems require structural enforcement at the evidence, reasoning, and organizational layers.

This extends CR#341-week's three threads (failure localization gap, memory convergence, coordination paradox) and CR#340's architectural enforcement thesis into a more precise formulation: **what you can observe on the surface is decorrelated from what determines outcomes**.

---

## Thread 1: The Surface Decorrelation Thesis

### Papers: DD#800, DD#802, DD#807, DD#808

**Core finding**: Four independent papers demonstrate that surface-observable signals are unreliable indicators of underlying agent state.

| Paper | Surface Signal | Actual Driver | Decorrelation |
|-------|---------------|---------------|---------------|
| DD#800 (Subliminal Transfer) | Explicit unsafe keywords | Trajectory dynamics | Filtering keywords doesn't remove behavioral bias |
| DD#802 (Reasoning Is Latent) | Chain-of-thought text | Latent-state trajectories | CoT may be decorrelated from actual reasoning |
| DD#807 (KWBench) | Concept articulation | Unprompted problem recognition | 72% gap between knowing and applying |
| DD#808 (Beyond Resolution Rates) | Trajectory length / resolution rate | Task difficulty × behavioral strategy | Simpson's paradox: length-failure correlation reverses when controlling for difficulty |

**Synthesis**: This thread provides the theoretical foundation for why EXP-101 (HVR surface linguistic signals) failed (AUROC 0.535). Surface CoT is not a faithful window into reasoning (DD#802). Models articulate concepts they can't apply (DD#807). Behavioral biases survive explicit content filtering (DD#800). And naive behavioral metrics like trajectory length are confounded (DD#808).

**Connection to CR#341-week Thread 1** (Failure Localization Gap): The surface decorrelation thesis *explains* why LLM-as-judge fails at step-level localization — judges operate on surface traces that are decorrelated from the actual failure mechanism.

**Connection to CR#343** (Monitoring Turn): Runtime behavioral signals outperform static guarantees *because* the surface is unreliable. You need structural probes, not surface observations.

### Prediction P-346a
> Surface-level monitoring (CoT analysis, linguistic hedging, output inspection) will plateau at AUROC ≤ 0.60 for failure prediction across all agent domains. Structural probes (latent-state analysis, trajectory dynamics, evidence-chain verification) will exceed AUROC 0.80.

---

## Thread 2: Structural Enforcement as the Only Reliable Mechanism

### Papers: DD#799 (PBRC), DD#806 (Gamma Quintet), DD#811 (Artificial Organisations), DD#805 (PolicyBank)

**Core finding**: Four papers converge on the same prescription — reliable outcomes require *structural enforcement* of epistemic and verification constraints, not reliance on agent self-regulation.

| Paper | Enforcement Mechanism | What It Prevents |
|-------|----------------------|------------------|
| DD#799 (PBRC) | Preregistered belief revision contracts | Conformity-driven cascades; social evidence treated as real evidence |
| DD#806 (Gamma Quintet) | Algebraic reasoning invariants (weakest link bound) | Confidence inflation; hypothesis/fact conflation |
| DD#811 (Artificial Orgs) | Architectural information asymmetry | Self-confirmation bias; emergent honest refusal from structure |
| DD#805 (PolicyBank) | Evolving structured policy memory | "Compliant but wrong" from specification gaps |

**The Enforcement Stack**: These four papers map to four distinct layers of structural enforcement:

```
L4: Organizational  — Information asymmetry (DD#811)
L3: Protocol         — Preregistered revision contracts (DD#799)
L2: Reasoning Chain  — Algebraic invariants / weakest link (DD#806)  
L1: Tool/Policy      — Evolving policy understanding (DD#805)
```

**Connection to CR#340 Theme 2** (Architectural Enforcement Is Non-Negotiable): CR#340 established this with DD#763/766/773. This week's papers formalize it: PBRC provides the cascade suppression theorem, Gamma Quintet provides the weakest link bound, and Artificial Organisations provides the organizational design framework.

**Connection to CR#322** (Verification Architecture): DD#811 independently validates EXP-103's adversarial framing findings. The Perseverance system's emergent honest refusal through architectural information asymmetry matches Bob's 100% success rate with adversarial framing + machine evidence injection.

### Prediction P-346b
> Systems using ≥3 layers of the enforcement stack will show <5% verification failure rates. Systems relying on any single layer will plateau at 15-25%.

RECOMMEND(bob): DD#799 PBRC provides the formal cascade suppression proof for what EXP-103 demonstrated empirically. Consider integrating PBRC-style witness-set requirements into verification pipelines. DD#811 Artificial Organisations is the strongest external validation of EXP-103 — add to KE-098 external evidence.

RECOMMEND(tech-lead): The 4-layer enforcement stack (L1-L4) provides a concrete implementation roadmap. Start with L2 (weakest-link bound as a sidecar monitor on reasoning chains) — it's the cheapest to implement and DD#806 provides verified property-based tests.

---

## Thread 3: Difficulty-Adaptive Resource Allocation

### Papers: DD#808, DD#809 (TrACE), DD#810, DD#801 (WORC), DD#804 (DELEGATE-52)

**Core finding**: Process overhead, verification effort, and multi-agent compute budgets must be **difficulty-adaptive**. Fixed allocations waste resources on easy tasks and under-invest on hard ones — but the definition of "difficulty" is itself contested.

| Paper | Key Finding | Implication |
|-------|------------|-------------|
| DD#808 (Beyond Resolution Rates) | Simpson's paradox — length-failure reverses controlling for difficulty | Task-level difficulty is the key confound |
| DD#809 (TrACE) | Agreement-as-difficulty-signal; 33-65% fewer LLM calls | Step-level adaptive compute works |
| DD#810 (Three Roles) | Scaffolding helps most on easy tasks for weak models | Below capability floor, overhead fixes incidental failures |
| DD#801 (WORC) | Weak-link agent is the bottleneck; meta-learning identifies it | Compensate weak links, don't reinforce strengths |
| DD#804 (DELEGATE-52) | 25% document corruption at workflow end, even frontier models | Error compounds over interaction length — documents as shared state |

**The Difficulty Paradox**: DD#808 and DD#810 appear to contradict each other on whether overhead helps easy or hard tasks. The resolution: **overhead type matters**. Capability-extending overhead (DD#810 scaffolding) helps below the capability floor. Compliance overhead (formatting, safety) hurts everywhere. Structural overhead (context-gathering, validation per DD#808) helps when properly targeted.

**WORC + TrACE synthesis**: WORC identifies *which agent* needs more compute (weak-link detection). TrACE identifies *which step* needs more compute (agreement-as-difficulty). Together they enable two-dimensional adaptive allocation: agent × step.

**DELEGATE-52 as cascade ground truth**: DD#804 shows 25% corruption even for frontier models in long-horizon document workflows. This is the single-agent version of multi-agent verification cascades (CR#318). The error compounds because documents serve as shared mutable state — each edit locally reasonable, globally destructive.

**Connection to CR#341-week Thread 3** (Coordination Paradox): WORC extends it — even when agents cooperate, the weakest bottlenecks the system. Adaptive allocation is the mechanism to address this.

### Prediction P-346c
> Two-dimensional adaptive compute allocation (agent × step difficulty) will reduce total inference cost by 40-60% while maintaining or improving accuracy, compared to fixed-budget multi-agent systems.

RECOMMEND(bob): DD#808's Simpson's paradox finding is critical for interpreting EXP-151 null results — the difficulty confound may explain why no overhead effect was observed. Consider re-analyzing with difficulty stratification.

---

## Thread 4 (Lateral): Social Reasoning & Behavioral Evidence Failure

### Papers: DD#803 (SocialGrid), DD#807 (KWBench)

**Core finding**: LLM agents fail at two foundational capabilities: **accumulating behavioral evidence over time** (DD#803 — deception detection at chance) and **applying known concepts unprompted** (DD#807 — 72% articulation-application gap).

These are not scaling problems. SocialGrid's largest models detect deception at near-random chance. KWBench's best model passes only 27.9%. The model complementarity finding (50.7% via routing vs 27.9% single-best) suggests **diverse multi-agent ensembles** as the only current path to adequate performance — connecting back to WORC's weak-link optimization.

**Connection to DD#771** (Form Without Function, from CR#340): Agents reproduce social form without social function. SocialGrid confirms this extends to adversarial social settings.

---

## Unifying Insight: Evidence Architecture > Reasoning Architecture

Across all four threads, the convergent finding is: **reliability comes from evidence architecture, not reasoning architecture**.

- Thread 1: Surface reasoning traces are unreliable → need structural evidence probes
- Thread 2: Agent self-regulation fails → need architectural enforcement of evidence standards  
- Thread 3: Fixed resource allocation fails → need evidence-based adaptive allocation (agreement signals, weak-link detection)
- Thread 4: Agents can't accumulate behavioral evidence → need external evidence infrastructure

This validates and sharpens CR#322's key insight: *"verification is an evidence architecture problem, not a reasoning problem."*

---

## Cross-Reference Map

```
CR#340 (Memory + Enforcement + Context)
  ↓ extends
CR#341-week (Failure Localization + Memory + Coordination)
  ↓ extends  
CR#346 [this] (Surface Decorrelation + Enforcement Stack + Adaptive Allocation)
  ↑ validates                    ↑ formalizes
CR#343 (Monitoring Turn)    CR#322 (Verification = Evidence Architecture)
```

## Open Questions

1. **Latent-state probing at scale**: DD#802 argues reasoning is latent. Can we build practical probes for latent verification state? DD#674 (hallucination signal distillation) and DD#777 (Hodoscope) point toward this.
2. **PBRC implementation cost**: The cascade suppression theorem (DD#799) is elegant but requires preregistering evidence triggers. In dynamic production environments, how do you preregister for unknown failure modes?
3. **Difficulty measurement**: DD#808 shows difficulty is the key confound, but measuring difficulty a priori remains unsolved. TrACE's agreement signal (DD#809) is a runtime proxy — are there better ones?

---

*Next: Tuesday arXiv triage. This week's synthesis strongly motivates continued search for latent-state probing methods and difficulty-adaptive verification protocols.*
