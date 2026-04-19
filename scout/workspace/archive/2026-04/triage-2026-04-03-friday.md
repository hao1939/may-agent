# Triage — Friday April 3, 2026

**Batch:** cs.MA: 12 entries (3 new, 9 cross-listed), cs.AI: 302 entries (78 new)

## cs.MA — New Papers

### 1. 2604.01240 — Computational Foundations for Strategic Coopetition
**Authors:** Pant, Yu (Toronto) | **Rating:** ★★★ SOLID
Formalizes sequential interaction and reciprocity in multi-stakeholder coopetition. Bounded reciprocity response functions, memory-windowed history, trust-gated reciprocity. 15,625 parameter configs validated, Apple iOS ecosystem empirical validation (84.3%). Fourth in a series (TR-1 through TR-4). Heavy on game-theoretic formalism, light on LLM/agent implementation. Relevant to trust dynamics (connects to DD#438 ETL, DD#474 trust monitoring) but primarily theoretical.
**Decision:** Monitor. Theory-heavy technical report series. The trust-gated reciprocity formalism could inform future MAS trust evolution designs.

### 2. 2604.01236 — DarwinNet: Evolutionary Network for Agent-Driven Protocol Synthesis
**Authors:** Xu, Li | **Rating:** ★★★ SOLID
Bio-inspired self-evolving network: L0 (physical anchor), L1 (WASM fluid cortex), L2 (LLM Darwin cortex). Intent-to-Bytecode pipeline. Protocol Solidification Index (PSI) for evolutionary maturity. Anti-fragility via environmental anomalies as evolution catalysts. Interesting conceptually but implementation unclear — primarily cs.NE/cs.NI, cross-listed to cs.MA.
**Decision:** Skip. Interesting concept but outside core MAS scope. The "slow thinking → fast thinking" compilation is reminiscent of Atlas/Compiled Memory (DD#XX).

### 3. 2604.01838 — Free Information Disrupts Even Bayesian Crowds
**Authors:** Eliaz, Spiegler (Tel Aviv) | **Rating:** ★★★★★ CRITICAL → DD#488
See DD#488 deep-dive. Even Bayesian agents making optimal decisions show crowd-level belief divergence when given free public information. Information that's individually helpful is collectively destabilizing. Counter-intuitive result with major MAS implications.
**Decision:** Full deep-dive. DD#488 written.

## cs.AI — Key Cross-Listings & Finds

### 4. 2604.01438 — ClawSafety: "Safe" LLMs, Unsafe Agents
**Authors:** Wei, Zhang, Pan, Mei, Wang, Hamm, Zhu, Ge | **Rating:** ★★★★ HIGH → DD#489
See DD#489 deep-dive. Model-level safety ≠ agent-level safety. 40-75% attack success across 5 frontier LLMs in agentic deployment. Trust hierarchy exploitation: highest-trust channels = highest ASR.
**Decision:** Full deep-dive. DD#489 written.

### 5. 2604.01359 — Semantic Modeling for World-Centered Architectures
**Authors:** Mantsivoda, Gavrilina | **Rating:** ★★★ SOLID
Proposes world-centered MAS (WMAS) as alternative to agent-centered architectures. Shared world model for semantic consistency, explainability, long-term stability. Introduces Ontobox platform. Relevant to shared state vs distributed state debate (connects to DD#481 "Drop the Hierarchy" — shared memory protocol). However, primarily formalism/ontology paper with limited empirical content.
**Decision:** Monitor. The WMAS concept is relevant but mostly a position paper.

### 6. 2604.01366 — CogBias: Measuring and Mitigating Cognitive Bias in LLMs
**Authors:** Huang, Zhang, Kwak, An | **Rating:** ★★★★ HIGH
Linear probes show cognitive biases are encoded as separable directions in activation space. Activation steering reduces bias 26-32% while preserving capability. Prompt-level debiasing backfires for Judgment biases. Cross-architecture consistency despite orthogonal representations. Major MAS implication: if individual agents have systematic biases, multi-agent aggregation may not cancel them out — connects directly to DD#488 (even Bayesian agents have collective pathologies).
**Decision:** Note for cross-reference. Connects to DD#488 and cognitive-bias thread.

## Covered IDs This Session
- 2604.01240, 2604.01236, 2604.01838, 2604.01438, 2604.01359, 2604.01366
