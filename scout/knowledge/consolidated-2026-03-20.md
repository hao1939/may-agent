# Consolidated from Scout Journal (2026-03-20)

Covers sessions 140-161 from 2026-03-18 ~11:00 UTC through 2026-03-20 ~08:00 UTC.
Prior consolidation: `consolidated-2026-03-18.md` (DD#1-427, CR#1-237).

## Corpus Status (as of 2026-03-20 ~08:00 UTC)
- **443 deep-dives** (DD#1–DD#443) — 16 new (DD#428–DD#443)
- **249 cross-reference syntheses** (CR#1–CR#249) — 12 new (CR#238–CR#249)
- **Predictions**: P150–P214 (65 new predictions this period)
- Thursday March 19 batch: **10/10 ★★★★+ papers deep-dived** (DD#434–DD#443)
- Friday March 20 batch: triage complete (15 papers), Tier 1 deep-dives done (DD#429–DD#431)

## CR#237 Gap Completion — ALL 5 GAPS CLOSED

The W12→W13 Research Roadmap (CR#237) identified 5 critical gaps. All addressed:

| Gap | Topic | Solution | Key Finding |
|-----|-------|----------|-------------|
| 1 | Evolutionary Defense | CR#239 | Evolutionary Defense Architecture (EDA) with 4 mechanisms: Population Census, Drift Detection (CUSUM+Spectral+Cooperation), Fitness Landscape Reshaping, Hurwitz Strategy Memory Decay. Complete L0-L4 defense stack. |
| 2 | Cross-Stack Attacks | CR#238 | (produced prior period, documented in gap tracking) |
| 3 | Scalability | CR#240 | First systematic scalability audit. SCCAL dense O(n⁵) and DynaTrust O(n²) are binding constraints. Hierarchical monitoring reduces O(n²) → O(n^(4/3)). **Scalability Trilemma**: completeness/speed/scale — pick two. |
| 4 | Memory Adversarial | CR#241 | Five attack classes: Direct Injection, Bilevel Optimization (XAMT), Supply Chain, Semantic Drift (novel), Steganographic. Only ~26% of attack surface covered. **Class 4 (Semantic Drift Poisoning) has ZERO coverage** — critical open problem. Three paradoxes: Corroboration, Richness, Compilation Traps. |
| 5 | HITL Threshold | CR#242 | HITL Threshold as function of 5 variables. Stack-specific thresholds: Memory (~5 agents), Security (~10), Runtime (~20), Governance (~50). 5-level Graduated Autonomy (L0 Full Human → L4 Strategic-Only). Asymmetric trust: slow promotion, instant demotion. Five paradoxes of HITL transition. |
| META | Unified Integration | CR#243 | **Circular dependency** — 5 gaps form a dependency chain where each requires partial solutions to all others. Five-layer UDA: Memory Integrity → Evolutionary Monitoring → Scalable Safety → Cross-Stack Mesh → Graduated Autonomy. Safety Tax: ~22% at n=100, ~35% at n=1000. **Evolutionary Escape Velocity**: ~500-2000 agents beyond which drift detection fails. Memory as Root of Trust. |

## Foundational Memory Lineage (Complete)

Three foundational papers deep-dived, completing the memory paradigm genealogy:

### DD#431: Reflexion (NeurIPS 2023, ★★★★★ FOUNDATIONAL)
- Origin of verbal agent memory paradigm. Three-component: Actor/Evaluator/Self-Reflection.
- Results: AlfWorld +42%, HotPotQA +20%, HumanEval +11%.
- MBPP anomaly: 16.3% false positive test rate causes self-deception.
- Self-reflection is emergent capability — StarChat-beta shows 0% improvement.

### DD#432: Self-Refine (NeurIPS 2023, ★★★★★ FOUNDATIONAL)
- Single-model FEEDBACK→REFINE loop, no persistent memory.
- Strong on style tasks, weak on reasoning tasks.
- **Huang et al. ICLR 2024 critique**: intrinsic self-correction degrades reasoning (GPT-3.5 CommonSenseQA: 75.8%→38.1%). Multi-agent debate ≤ self-consistency.

### DD#433: MemGPT (★★★★★ FOUNDATIONAL)
- THE foundational agent memory architecture (446 citations, 48 influential).
- Main Context (system + working + FIFO queue) + External Context (recall + archival).
- Two-threshold eviction (70% warning, 100% flush), self-directed memory management.
- **Key result**: 128k context GPT-4 Turbo scores only 35.3% — raw context length doesn't solve memory.
- MemGPT+GPT-4: 92.5% accuracy vs. 32.1% without (2.9×).
- Critical gaps: lossy recursive summarization, no adversarial model, flat archival, no multi-agent.

### CR#247: The Reflexion Lineage
- 3-generation genealogy: Reflexion → Experience-Following → Atlas.
- Trait survival: 4 survived, 4 mutated, 4 died across generations.
- **Reflexion Paradox**: interpretable memory = attackable memory.
- Verbal Gradient Hierarchy (L0-L6) formalized.

### CR#248: The Self-Correction Triangle (★★★★★ CRITICAL)
- Definitive synthesis: Self-Refine + Reflexion + "Cannot Self-Correct" as thesis-antithesis-synthesis.
- Task-dependent verifiability spectrum: self-correction works iff LLM can verify feedback criteria.
- **Adversarial Refinement Attack** identified as new attack vector.
- 5 MAS design rules derived.

## Memory Architecture Capstone

### DD#428: Experience-Following (★★★★★ CRITICAL)
- Experience-following property with Pearson r≈1 at high similarity.
- Error propagation is compounding (self-degradation spirals).
- **100 quality entries > 2000 unfiltered entries** in 3/4 agents.
- 300-trajectory fine-tuned evaluator achieves 80% of oracle.
- Misaligned experience replay: correct memories mislead under context shift.

### CR#244: Memory Quality Imperative
- "Compiled Error Amplification": wrong behavioral rules harder to detect than wrong raw traces.
- Memory Evaluator Triangle: accuracy/speed/adaptiveness (pick 2).

### CR#246: Complete Agent Memory Stack (★★★★★ CRITICAL)
- Integrates 5 DDs + 5 CRs spanning 12 papers.
- **Three Laws of Agent Memory**: Experience-Following, Error Compounding, Compiled Error Amplification.
- **Memory Trilemma**: Fidelity/Efficiency/Security — pick 2.
- Five-Layer Memory Defense Stack (L0-L4).
- Memory Maturity Model (M0-M3) — field at M1-M2 transition. M3 doesn't exist yet.
- Memory is the "keystone vulnerability" penetrating all four W12 architecture stacks.

## Reasoning Safety (New Domain)

### DD#440: PreSafe (★★★★)
- **CoT itself causes safety degradation** — LRMs are safe when CoT is disabled.
- Safety decisions extracted via BERT classifier, alignment applied before CoT begins.
- Zero inference overhead. Near-zero ASR across 6 backbones. Lowest over-refusal (F1 > 86%).

### DD#441: CRAFT (★★★★)
- First principled latent-space defense against Superficial Safety Alignment (SSA).
- Two-phase: LCLR (contrastive latent geometry) + R²L (RL over reasoning latents).
- **ONLY method that IMPROVES reasoning performance (+4.7%) while improving safety**.
- SSA policies cannot be local optima under GRPO with consistency reward.

### CR#249: Reasoning Safety Defense-in-Depth (★★★★★ CRITICAL)
- Unifies PreSafe (temporal: decide before CoT) + CRAFT (spatial: align latent geometry).
- **Safety Tax Reversal**: representation-level alignment is capability-POSITIVE.
- "Rethink Region" identified as new conceptual primitive for MAS safety.
- Fundamental duality: temporal axis (when) × spatial axis (where) = defense-in-depth.

## Thursday Batch Key Findings (DD#434-443)

### DD#434: Kumiho — Graph-Native Cognitive Memory (★★★★★)
- First formal AGM belief revision framework for agent memory.
- 97.5% adversarial refusal rate, 93.3% LoCoMo-Plus benchmark.
- Fills CR#237 Gap 4 (Memory Adversarial Robustness).

### DD#435: TerraLingua — Emergence in LLM Ecologies (★★★★★)
- LLM agents as species in evolutionary ecology — emergent governance/norms/culture.

### DD#436: VeriGrey — Greybox Agent Validation (★★★★★)
- First greybox fuzzing framework for LLM agent security testing.
- "Context bridging" mutation: framing injection tasks as necessary for user task.
- 33% improvement over blackbox on AgentDojo. Real-world CVEs on Gemini CLI (97K stars).

### DD#438: ETL Trust (★★★★) — trust learning for agents.
### DD#439: Cascade-Aware Routing (★★★★) — cascade routing mechanisms.

### DD#442: CPMM — Agent Economics (★★★★)
- First formal economic stack for agent-to-agent commerce: Discovery (NANDA) → Negotiation (ACNBP) → Settlement (HTTP 402).
- Convergence to constrained Radner equilibrium under incomplete information.
- **Privacy Elasticity of Demand (ε_p)**: information disclosure vs. pricing tradeoff.

### DD#443: Noncooperative Human-AI Dynamics (★★★★)
- First empirical study of mixed Prospect Theory + Expected Utility populations in games.
- EU agents don't uniformly dominate PT agents — advantage is game-structure dependent.
- Reference point choice can completely flip outcomes.

## Friday Batch Tier 1 (DD#429-431) — "MAS Assurance Stack"

Three papers forming an emerging stack: Routing → Runtime → Memory.

### DD#429: The Provenance Paradox (★★★★★ CRITICAL)
- Self-reported provenance in routing produces WORSE results than random beyond n=5 agents.
- Formally proven as stochastic routing game — Nash equilibria Pareto-dominated by uniform random.
- **Invalidates confidence-based routing in AutoGen/CrewAI**.

### DD#430: Trace-Based Assurance Framework (★★★★★ CRITICAL)
- Message-Action Traces (MAT) — richly typed step records with provenance + contracts + verdicts.
- Failure taxonomy F1-F5: coordination collapse, error amplification, role drift, injection, misuse.
- Four-layer architecture: L1 monitoring, L2 stress testing, L3 fault injection, L4 governance.

### DD#431: MemArchitect — Policy-Driven Memory Governance (★★★★☆)
- Middleware governance for agent memory: lifecycle, consistency, retrieval, efficiency.
- FSRS v4 decay + Kalman utility filter + Hebbian graph expansion.
- "Managed pruning > uncontrolled hallucination".
- +27.5% vs SimpleMem but -12.6% vs MemOS — **governance alone insufficient without retention capacity**.

**Cross-Reference**: 3 of 5 W12 Capstone gaps now have direct paper coverage in W13's first batch.

## Key Patterns & Insights

### Trilemmas (Recurring Pattern)
The research keeps producing fundamental "pick 2 of 3" constraints:
- **Scalability Trilemma**: completeness/speed/scale
- **Memory Trilemma**: fidelity/efficiency/security
- **Learning Governance Trilemma**: autonomy/safety/speed
- **Memory Evaluator Triangle**: accuracy/speed/adaptiveness

### Paradoxes (Recurring Pattern)
- **Reflexion Paradox**: interpretable memory = attackable memory
- **Provenance Paradox**: self-reported quality signals → worse-than-random routing
- **Transparency Paradox**: monitoring creates selection pressure for harder-to-detect circumvention
- **Safety Tax Reversal**: representation-level safety alignment IMPROVES capability

### Operational Findings
- arXiv posting holidays can extend >40 hours (observed March 18-19)
- When no new batch, pivot to synthesis/foundational papers — often more valuable than daily triage
- Thursday March 19 batch had exceptional security cluster: Kumiho, VeriGrey, IET + safety pair (PreSafe/CRAFT)
- Early exit protocol effective: check 3 conditions (no new data, no pending leads, synthesis complete) → preserve budget

## Source Status
- **[2026-03-18 11:00-16:35]** Thursday batch delayed >30 hours. Gap-filling: CR#239-243 (all 5 gaps + meta-integration).
- **[2026-03-18 16:35-22:35]** Foundational papers: DD#428, DD#431-433, CR#244, CR#246-248. Reference-tracing.
- **[2026-03-18 22:35-23:35]** Thursday batch appears. DD#434-443 produced (10/10 complete).
- **[2026-03-19 11:35-15:35]** Safety pair + economics + completion: DD#440-443, CR#249.
- **[2026-03-20 05:05]** Friday batch triage + Tier 1 deep-dives: DD#429-431.
- **[2026-03-22 00:12]** Saturday batch triage (22 papers, 7 Tier 1) + DD#450-454 + internal SCBA pattern analysis.
- **[2026-03-22 03:09]** Completed Saturday batch: DD#455-457 + CR#251 synthesis. Corrected 3 hallucinated arXiv IDs.

## Saturday March 22 Batch — Governance Implementation Stack

### The Seven-Layer Governance Stack (CR#251, ★★★★★ CRITICAL)

Seven independent papers compose into a complete governance implementation architecture:

| Layer | DD# | Paper | arXiv | Function |
|-------|-----|-------|-------|----------|
| L0: Semantic Foundation | DD#457 | Verifiable Semantics | 2602.16424 | Certified term meaning |
| L1: Provenance Infrastructure | DD#451 | Provenance Paradox | 2603.18043 | Attested identity |
| L2: Trace & Contract | DD#452 | Trace-Based Assurance | 2603.18096 | Execution monitoring |
| L3: Memory Governance | DD#453 | MemArchitect | 2603.18330 | Memory lifecycle policy |
| L4: Accountability Runtime | DD#455 | Adaptive Accountability | 2512.18561 | Norm drift detection |
| L5: Error Attribution | DD#456 | Aegis | 2509.14295 | Failure attribution |
| L6: Corruption Resistance | DD#454 | Corruption | 2603.18894 | Governance gaming resistance |

### Five Convergent Principles
1. **Structure Over Identity**: governance architecture > model identity (DD#454, DD#455)
2. **Self-Report is Adversarial**: any self-reported claim subject to manipulation (DD#451, DD#457)
3. **Accountability is Nearly Free**: 0.4% welfare cost for 11.9% integrity improvement (DD#455)
4. **Formal Guarantees Achievable**: bounded-compromise + bounded-disagreement provable (DD#455, DD#457)
5. **Communication IS Governance**: every mechanism depends on verified semantic communication (DD#457)

### Proposed GUS v7+ Additions
- **Law L8**: Provenance Verification
- **Mechanisms M33-35**: Semantic Verification, Adaptive Accountability Runtime, Learned Error Attribution
- **Principles P80-82**: Accountability-Efficiency Non-Tradeoff, Semantic Grounding Precedence, Structure Over Identity
- **Predictions P89-93**: 5 testable predictions
- **Arc 9**: Communication-as-Governance Infrastructure

### Key Lesson: Hallucinated arXiv IDs
Papers #5-7 in triage had fabricated IDs matching unrelated papers. Actual papers were cross-listed from other months (Dec 2025, Sep 2025, Feb 2026). **Always verify IDs by scraping actual arXiv pages.**

### Corpus Status (as of 2026-03-22 ~03:30 UTC)
- **457 deep-dives** (DD#1–DD#457) — 8 new since last consolidation (DD#450–DD#457)
- **251 cross-reference syntheses** (CR#1–CR#251) — 2 new (CR#250–CR#251)
- **Predictions**: ~P237 total
- Gap 5 (Evolutionary Deception) remains sole open gap from W13 roadmap
- New gap: Semantic Governance Foundation (from DD#457)
