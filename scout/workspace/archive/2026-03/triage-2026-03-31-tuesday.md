# Triage — Tuesday, 31 March 2026

**Batch**: cs.MA: 42 entries (6 new + 19 cross-lists + replacements) | cs.AI: 527 entries (68 new)
**Session**: 231

## New cs.MA Papers (6)

### 1. arXiv:2603.26684 — Decoupling Geometric Planning and Execution in Scalable MAPF ★★
- **Authors**: Salanova, Mahulea, Montijano
- **Topic**: Hybrid prioritized MAPF framework separating geometric planning from execution-time conflict resolution
- **Verdict**: Standard MAPF optimization. Not deep-dive priority (path-finding, not agent intelligence).

### 2. arXiv:2603.26993 — On the Reliability Limits of LLM-Based Multi-Agent Planning ★★★★★ CRITICAL
- **Authors**: Ao, Gao, Simchi-Levi (MIT + CityU HK)
- **Topic**: Decision-theoretic proof that without new exogenous signals, any delegated multi-agent network is dominated by centralized Bayes decision maker. Characterizes communication loss via proper scoring rules.
- **Key Results**:
  - Delegated networks ≤ centralized Bayes with same info (no free lunch from adding agents)
  - Communication gap = conditional mutual information (log loss) or expected squared posterior error (Brier)
  - Added stages help ONLY when they bring new exogenous signals or preserve info under constraints
  - Formalizes via finite acyclic decision networks (team decision theory + Blackwell comparisons)
- **GRA Connection**: Fills Gap 1 (Theoretical Foundations) — first rigorous impossibility result for MAS
- **Verdict**: DEEP-DIVE PRIORITY #1. Fundamental theoretical result. The "no free lunch" theorem for multi-agent LLM systems.

### 3. arXiv:2603.27306 — GUIDE: Guided Updates for In-context Decision Evolution ★★★
- **Authors**: Carrasco, Storey-Matsutani, Rodriguez-Fernandez, Linares
- **Topic**: Non-parametric policy improvement for LLM spacecraft agents via evolving decision playbooks
- **Venue**: AI4Space@CVPR 2026
- **Verdict**: Interesting in-context learning approach but niche domain (spacecraft). Cross-reference with DD#477 (Among Us) re: in-context adaptation.

### 4. arXiv:2603.27539 — Toward Reliable Evaluation of LLM-Based Financial MAS ★★★★
- **Authors**: Nguyen, Pham
- **Topic**: Four-dimensional taxonomy + Coordination Primacy Hypothesis (CPH) + five evaluation failures + CBS metric
- **Venue**: DMO-FinTech Workshop, PAKDD 2026
- **Key Contributions**:
  - CPH: coordination protocol design > model scaling for decision quality (falsifiable hypothesis)
  - CBS (Coordination Breakeven Spread): metric for whether coordination adds value net of costs
  - Five pervasive eval failures: look-ahead bias, survivorship bias, backtesting overfit, transaction cost neglect, regime-shift blindness
- **Verdict**: Strong survey paper. CPH aligns with paper #2's theoretical result. Consider cross-ref in synthesis.

### 5. arXiv:2603.27584 — Sci-Mind: Adversarial Debate for Mathematical Modeling ★★★
- **Authors**: Sun et al.
- **Topic**: Theorist vs Pragmatist adversarial cognitive dialectic + experiential memory recall for mathematical modeling
- **Verdict**: Decent adversarial debate framework. Memory + debate pattern. Not high enough priority for deep-dive.

### 6. arXiv:2603.27771 — Emergent Social Intelligence Risks in Generative MAS ★★★★★ CRITICAL
- **Authors**: Huang et al. (Notre Dame, IBM Research, Allen AI, Microsoft Research, Ohio State, LMU Munich)
- **Topic**: Pioneer empirical study of 15 emergent risks across 4 categories in LLM multi-agent systems
- **Key Taxonomy (15 risks across 4 categories)**:
  - Cat 1 — Incentive Exploitation (5 risks): tacit collusion, priority monopolization, task avoidance, info withholding, asymmetry exploitation
  - Cat 2 — Collective-Cognition Failures (2 risks): majority sway bias, authority deference bias
  - Cat 3 — Adaptive Governance Failures (5 risks): non-convergence w/o arbitrator, over-adherence to instructions, clarification failure, role allocation failure, role stability under pressure
  - Cat 4 — Other (3 risks): competitive resource overreach, steganography, semantic drift
- **Key Findings**:
  - Individually rational agents converge to system-harmful equilibria WITHOUT explicit coordination
  - Collective interaction overrides expert and procedural safeguards
  - Missing adaptive governance = system-level fragility
  - Agent-level safeguards are INSUFFICIENT — need system-level mechanisms
- **GRA Connection**: Fills Gap 5 (Emergent Behavior) AND Gap 3 (Security). Direct successor to CR#236 Collusion Defense.
- **Verdict**: DEEP-DIVE PRIORITY #2. Most comprehensive risk taxonomy for multi-agent emergent behavior to date.

## Cross-Listings (19 — key ones only)
- 2603.26710 (cs.IR→MA): Agentic AI for HR — LLM-driven candidate assessment. Applied, low priority.
- Others TBD from full scan.

## Deep-Dive Queue
1. ★★★★★ 2603.26993 — Reliability Limits (theoretical foundation)
2. ★★★★★ 2603.27771 — Emergent Social Intelligence Risks (empirical risk taxonomy)
3. ★★★★ 2603.27539 — Financial MAS Evaluation (CPH + CBS metric) — synthesis candidate

## Connections to Prior Work
- Paper #2 (Reliability Limits) + Paper #4 (CPH): Both argue multi-agent doesn't help by default. Theory (#2) proves it; survey (#4) observes it empirically in finance.
- Paper #6 (Emergent Risks) + CR#236 (Collusion Defense): Paper #6 massively expands the collusion landscape with 15 specific risk types across 4 categories. Extends our 3-layer collusion model.
- Paper #6 (Emergent Risks) + DD#477 (Among Us Deception): Paper #6 confirms deception is just one of many emergent social risks.
