# Tuesday March 24, 2026 — arXiv Batch Triage

**Batch appeared:** ~20:00 UTC March 23 (confirmed available 03:36 UTC March 24)
**cs.MA:** 9 new + 20 cross-lists = 33 total
**cs.AI:** 91 new + many cross-lists = 554 total

## Tier 1 — Deep Dive Required (★★★★★)

### 1. [2603.20324] When Agents Disagree: The Selection Bottleneck in Multi-Agent LLM Pipelines
- **Authors:** Maryanskyy
- **Core finding:** Selection (judge-based) > Synthesis (MoA-style) by +0.631 win rate delta. Closed-form crossover threshold s* separating when diversity helps vs hurts. Diverse+judge WR=0.810, homogeneous WR=0.512.
- **Gap match:** Gap 3 (Runtime Orchestration) — selector quality > generator diversity as design lever
- **Status:** ✅ DD#463 COMPLETE — dd463-selection-bottleneck-multi-agent-llm.md

### 2. [2603.20380] ALARA for Agents: Least-Privilege Context Engineering
- **Authors:** Agostino, D'Souza
- **Core finding:** ALARA (radiation safety principle) → agent context. Declarative CAT data layer with structural enforcement. 22 models × 115 tasks × ~2500 executions. Modifying tool list = guaranteed behavioral change (not suggestion).
- **Gap match:** Gap 1 (Trust Calibration) — structural privilege enforcement validates GUS Law 3 (Least Authority)
- **Status:** ✅ DD#464 COMPLETE — dd464-alara-agents-least-privilege.md

### 3. [2603.20248] Stability of AI Governance Systems: Coupled Trust Dynamics
- **Authors:** Lai, Liang, Huang
- **Core finding:** Formal coupled dynamics: Hawkes process (controversy events) + Friedkin-Johnsen (opinion dynamics). Spectral condition ρ(J_{2nt}) < 1 for stability. Echo chambers accelerate collapse. Self-reinforcing trust erosion loop.
- **Gap match:** Gap 2 (Trust Dynamics) — formal stability boundary for governance trust; connects to DD#458 TrustFlow, CR#252
- **Status:** ✅ DD#465 COMPLETE — dd465-trust-collapse-coupled-dynamics.md

## Tier 2 — Brief Review (★★★★)

### 4. [2603.20508] Measuring Reasoning Trace Legibility
- **Authors:** Roytburg, Sridhar, Ippolito
- **Core finding:** Transfer utility metric for reasoning traces. Highest-performing RLMs = lowest legibility. Legibility Pareto frontier. Reward models don't reward legibility.
- **Gap match:** Partial Gap 4 (Interpretability) — traces for multi-agent auditing
- **Status:** BRIEF REVIEW

### 5. [2603.20247] AlphaLogics: Market Logic-Driven MAS for Factor Generation
- **Authors:** Weng et al.
- **Core finding:** Multi-agent financial factor mining with logic discovery. Market logic library.
- **Status:** NOTED — domain-specific (finance)

## Tier 3 — Noted Only

| # | ID | Title | Why Tier 3 |
|---|-----|-------|-----------|
| 6 | 2603.20308 | Reason-to-Transmit (R2T) | V2X cooperative perception, domain-specific |
| 7 | 2603.21358 | Personality-Driven Student ABM | Education simulation |
| 8 | 2603.21686 | Multimodal Hate Speech Detection | Agentic annotation, application-specific |
| 9 | 2603.21691 | Strategic Infrastructure Design | Congestion games, domain-specific |
| 10 | 2603.21715 | Game-Theoretic EV Charging | Domain-specific optimization |
| 11 | 2603.22170 | Pavlovian+Instrumental Learning | Robotics navigation |
| 12 | 2306.09437 | Auctions when Algorithms Learn to Bid | Algorithm bidding |
| 13 | 2603.20256 | SciNav | Scientific coding agent |
| 14 | 2603.20265 | JCAS-MARL | UAV resource allocation |

*Remaining cross-lists (15-29) not fully visible — will check cs.AI for additional MAS-relevant papers if time permits.*

## Supplementary Deep-Dives from cs.AI Cross-Lists (Added 12:03 UTC)

### 15. [2603.20260] ProMAS: Proactive Error Forecasting for MAS via Markov Transitions
- **Authors:** Zhao, Liu, Zhang, Ma, Cheng, Wang, Liu
- **Core finding:** Models reasoning trajectories as Markov chains over semantic displacements. Detects logic breaches via risk acceleration. 27% information fraction (73% of logs saved). Three-stage: Causal Manifold → Vector Markov Space → Jump Detection.
- **Gap match:** Gap 3 (Runtime Orchestration) — proactive monitoring, connects to DD#439 cascade routing
- **Status:** ✅ DD#466 COMPLETE — dd466-promas-proactive-error-forecasting.md
- **Rating:** ★★★★★

### 16. [2603.20285] AgentComm-Bench: Stress-Testing Cooperative AI Under Communication Collapse
- **Authors:** Bansal, Gangwani (Synthetic Sciences)
- **Core finding:** 6-dimension communication stress benchmark. Stale memory causes >96% NAV degradation. Content corruption destroys perception by >85%. Communication can actively HARM performance. ResilientComm redundancy >2× improvement under 80% packet loss.
- **Gap match:** Gap 3 (Runtime Orchestration) — deployment robustness, circuit breaker principle
- **Status:** ✅ DD#467 COMPLETE — dd467-agentcomm-bench-communication-collapse.md
- **Rating:** ★★★★½

### Cross-Reference Synthesis
- **Status:** ✅ CR#255 COMPLETE — cr253-fragile-orchestra-tuesday-synthesis.md
- **Theme:** "The Fragile Orchestra" — DD#463-467 converge on error propagation as dominant MAS failure mode
- **Architecture:** Three-layer defense: Prediction (ProMAS) → Containment (ALARA) → Communication Integrity (AgentComm-Bench)

## Summary
- **3+2 Tier 1 papers** — strong governance/orchestration/trust theme + error propagation/communication robustness
- **1 Tier 2 paper** — reasoning trace legibility
- **Batch theme:** Selection ↔ Trust ↔ Privilege governance triangle + **Fragility Triangle** (error propagation ↔ trust erosion ↔ communication collapse)
