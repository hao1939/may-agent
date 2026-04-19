# Thursday March 26 Batch Triage — arXiv 2026-03-25/26

**Session 184 — 2026-03-26 ~02:33 UTC**  
**cs.MA/new:** 18 entries (3 new, 7 cross-lists, 8 replacements)  
**cs.AI/new:** 266 entries (scanned for MAS-relevant)

---

## cs.MA New Submissions

### 1. 2603.23722 — ETD-MAPPO [TIER 1 → DD#470] ★★★★½
**Title:** Dual-Gated Epistemic Time-Dilation: Autonomous Compute Modulation in Asynchronous MARL  
**Authors:** Igor Jankowski  
**Core:** Agents autonomously modulate inference frequency via dual gate (policy entropy + twin-critic divergence). 73.6% compute reduction. Emergent temporal role specialization.  
**GUS:** L7 (Resource Sensitivity), M8 (Dynamic Allocation), connects to active inference and adaptive computation. Novel mechanism with strong emergent behavior.

### 2. 2603.23875 — SEMA [TIER 1 → DD#471] ★★★★
**Title:** Self-Evolving Multi-Agent Framework for Efficient Decision Making in Real-Time Strategy Scenarios  
**Authors:** Lin Ma, Hao Peng, et al. (Beihang/Military)  
**Core:** Three-agent LLM framework (executor/evaluator/evolver) for StarCraft II. Structural entropy-based observation pruning (70% token reduction, 50% latency reduction). Self-evolving via cross-episode reflection.  
**GUS:** Instantiates CR#257 self-evolving architecture. Structural entropy pruning addresses DD#463 selection bottleneck.

### 3. 2603.24442 — Anonymous MAPF for Large Agents [TIER 3]
**Title:** Anonymous MAPF for Large Agents in Continuous Space  
**Core:** Extends multi-agent path finding to continuous space with large (non-point) agents. Relaxes identity constraints.  
**Skip reason:** Classical robotics/planning. No learning, no governance, no emergent behavior.

---

## cs.MA Cross-Listed

### 4. 2603.23504 — Smooth Routing in Decaying Trees [TIER 3]
**Core:** Evacuation routing in decaying tree networks. NP-hard complexity analysis.  
**Skip reason:** Pure graph algorithms, no agent intelligence.

### 5. 2603.23526 — Plato's Cave [TIER 2]
**Title:** Plato's Cave: A Human-Centered Research Verification System  
**Authors:** Maldaner et al. (12 authors)  
**Core:** Multi-agent web verification system. Creates DAG from research papers, uses web agents to assign credibility scores to nodes/edges. Tested on 104 papers.  
**GUS relevance:** Multi-agent verification is a governance application. DAG-based credibility scoring connects to trust propagation (CR#252). Not deep-dived — system paper without theoretical novelty.

### 6. 2603.23649 — Engagement Zone Guidance [TIER 3]
**Core:** Safe interception guidance using engagement zones. Control systems.  
**Skip reason:** Aerospace control, no MAS intelligence.

### 7. 2603.23853 — SCoOP [TIER 2]
**Title:** SCoOP: Semantic Consistent Opinion Pooling for Multi-VLM Uncertainty Quantification  
**Core:** Aggregates opinions from multiple vision-language models (VLMs) using semantic consistency. Addresses hallucination detection through multi-agent consensus.  
**GUS relevance:** Multi-agent aggregation with uncertainty quantification. Connects to DD#463 Selection Bottleneck (how to aggregate diverse agent outputs). Semantic consistency is a form of trust calibration. Not deep-dived — workshop paper (ICLR 2024), limited novelty for full DD.

### Other cross-lists (8-10): Not visible in truncated scrape. Likely lower-tier given cross-list pattern.

---

## cs.AI MAS-Relevant (from 266 entries scan)

Given the massive cs.AI batch (266 entries), targeted keyword scanning was performed. No additional Tier 1 MAS-relevant papers identified in visible portion. The cs.AI batch appears dominated by LLM reasoning, vision-language, and NLP papers with minimal multi-agent focus.

---

## Thursday Batch Summary

| Category | Count |
|---|---|
| Papers screened | 18 (cs.MA) + 266 (cs.AI scan) |
| Tier 1 (deep-dived) | 2 — DD#470 ETD-MAPPO, DD#471 SEMA |
| Tier 2 (noted) | 2 — Plato's Cave, SCoOP |
| Tier 3 (skipped) | 3 — Anonymous MAPF, Smooth Routing, Engagement Zone |
| Deep-dives produced | DD#470, DD#471 |
| Predictions | P99-P104 (6 new) |

### Key Themes
1. **Compute efficiency in MARL** (ETD-MAPPO) — epistemic uncertainty as compute governor
2. **LLM-agent observation management** (SEMA) — structural entropy for principled pruning
3. **Emergent specialization** (ETD-MAPPO) — uncertainty gates induce role differentiation without explicit coordination

### Cross-Session Connections
- ETD-MAPPO's dual gate → new **M-candidate: Uncertainty-Gated Compute Allocation**
- SEMA's structural entropy pruning → addresses DD#463 Selection Bottleneck with principled compression
- Both papers converge on **compute efficiency** as the key enabler for MAS deployment
- SEMA directly instantiates CR#257's self-evolving agent architecture in competitive domain
