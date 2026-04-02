# Deep-Dive: CogSearch — Cognitive-Aligned Multi-Agent Framework for Proactive Decision Support in E-Commerce Search

**Paper:** arXiv:2603.11927  
**Authors:** Zhouwei Zhai, Mengxiang Chen, Haoyun Xia, Jin Li, Renquan Zhou, Min Yang (JD.com)  
**Date:** March 12, 2026  
**Venue:** cs.MA  
**Rating:** ★★★★☆ (Production-deployed multi-agent system with real A/B test results)

---

## 1. Core Problem

Traditional e-commerce search operates as a **passive retrieval-and-ranking pipeline**, failing to support complex decision-making. Users face "cognitive friction" — overwhelmed by options, unable to synthesize multi-attribute comparisons, and forced to do the decision-making work themselves. CogSearch reframes search as **proactive decision support**.

## 2. Architecture — Four-Agent Framework

Grounded in **Simon's three-stage decision model** (Intelligence → Design → Choice):

### Agent Roles:
1. **Planner Agent** — Intent decomposition engine. Takes user query + search history + click context → generates a **Directed Acyclic Graph (DAG)** of atomic cognitive tasks. Three task types:
   - ProductSearch (internal inventory)
   - WebSearch (open-world knowledge)
   - ToolInvocation (external APIs via MCP)

2. **Executor Agent** — Multi-source information acquisition:
   - ProductSearch: Keyword-vector fusion retrieval + product attribute enrichment + review summarization
   - WebSearch: "Expand-Retrieve-Filter" pipeline with multi-criteria scoring (relevance × authority × freshness)
   - Tool Integration: Dynamic API invocation (weather, logistics, price trends)

3. **Guider Agent** — Cognitive-aligned guidance via Clarify-Guide-Contextualize (CGC) mechanism:
   - Dynamic facet generation based on information gain maximization
   - Personalized purchase strategy ("buying guides" from multi-source intelligence)
   - Dual-purpose query suggestions: convergent (zoom in) + stimulative (expand search space)

4. **Decider Agent** — Terminal cognitive nexus. Multi-criteria decision execution across 4 dimensions:
   - Functional performance
   - Economic viability
   - Reliability (cross-verified internal + external signals)
   - Constraint adherence
   - Outputs: optimal item + natural language rationale

### Memory System:
Central hub storing contextual memories, agent states, and task graphs for multi-turn coherence.

## 3. Quantitative Results

### Offline (ECCD-Bench, 10K expert-annotated query-response pairs):

| Method | Simple (ACC@5/UDS) | Complex (ACC@5/UDS) | Consultative (ACC@5/UDS) |
|--------|-------------------|---------------------|--------------------------|
| Online baseline | 0.87/2.64 | 0.48/1.92 | 0.60/1.81 |
| **CogSearch** | **0.87/2.70** | **0.83/2.79** | **0.65/2.88** |

- Complex queries: ACC@5 **+73%** (0.48 → 0.83)
- Consultative UDS: **+59%** (1.81 → 2.88)

### Ablation Results (Critical Findings):
| Removed Component | Impact |
|-------------------|--------|
| w/o Planner | Complex ACC@5 drops 37.3%, UDS drops 26.5% |
| w/o WebSearch | Consultative UDS drops 25.3% |
| w/o Guider | Complex UDS drops 20%, Consultative UDS drops 27% |
| w/o Decider | Universal UDS decline |
| w/o Memory | All metrics decrease |

**Key insight:** Every agent is necessary. The Planner is most critical for complex queries; the Guider is most critical for consultative scenarios.

### Online A/B Test (JD.com, 2 weeks, 10% live traffic):
- **Decision Cost: -5%** (fewer interactions needed per transaction)
- **Overall UCVR: +0.41%** (at JD.com scale, this is massive revenue impact)
- **Decision-heavy queries UCVR: +30%** (professional interpretation, gift selection, comparisons)
- **Long query proportion: +25%** (users shift toward natural language expression)

## 4. Production Engineering Details

### Model Selection (Latency-Optimized):
- Planner + Guider: **Qwen3-4B** (lighter models for orchestration/guidance)
- Decider: **Qwen3-8B** (heavier model for reasoning)
- All fine-tuned via **knowledge distillation from DeepSeek-R1**
- INT8 quantization + caching + parallel scheduling

### Latency:
- CogSearch: **1.3s** average end-to-end
- Traditional search: **800ms**
- Gap mitigated via **streaming output**

### Deployment:
- Integrated via opt-in "AI Search" entry on JD.com
- Now **fully deployed** on platform

## 5. Connection to Our Research Framework

### Validates Key Laws from Grand Unified Synthesis:

1. **Law of Distributed Cognition** — Four specialized agents outperform monolithic LLM search. Each agent maps to a cognitive function (understanding, gathering, guiding, deciding).

2. **Law of Structured Communication** — DAG-based task decomposition provides explicit dependency modeling between agents. Memory System ensures coherent cross-agent state.

3. **Law of Specialization** — The ablation study proves each specialized agent contributes uniquely. Removing any one degrades specific capabilities (not just general performance).

4. **Law of Verification Necessity** — Decider Agent implements multi-criteria verification before final recommendation. Cross-verification of internal reviews vs. external signals.

### Connection to Other Papers:

**vs. VMAO (2603.11445):**
- Both use DAG decomposition for task planning
- CogSearch's Planner generates task DAGs similar to VMAO's plan decomposition
- Difference: CogSearch is user-facing decision support; VMAO is internal agent orchestration

**vs. MindSearch / Intelligence Paradox:**
- CogSearch is a counter-example to the Intelligence Paradox (more agents = worse collective intelligence)
- CogSearch succeeds because agents have **clearly delineated cognitive roles** with minimal overlap
- Validates finding that role clarity prevents degradation

**vs. ADAS (2603.12229):**
- CogSearch uses fixed architecture (4 agents, defined roles)
- Shows that well-designed fixed architectures can be production-ready
- ADAS would explore whether dynamic architecture could improve CogSearch

**vs. Multi-turn Degradation (2603.11394):**
- CogSearch's Memory System + Guider Agent explicitly combat multi-turn coherence problems
- The "convergent queries" mechanism prevents intent drift

## 6. Novel Contributions

1. **First large-scale production deployment** of multi-agent LLM system for e-commerce search with published A/B test results
2. **Cognitive alignment framework** — mapping agent roles to Simon's decision model
3. **ECCD-Bench** — 10K expert-annotated benchmark for cognitive e-commerce search
4. **30% UCVR lift for complex queries** — strongest published evidence that multi-agent systems outperform single-model systems in production
5. **Practical latency management** — shows how to deploy multi-agent reasoning within acceptable latency constraints (1.3s with streaming)

## 7. Limitations

- Single-platform validation (JD.com only)
- Chinese e-commerce context — generalizability uncertain
- 1.3s latency still 60% slower than traditional search
- No comparison with other multi-agent frameworks (only vs. traditional search baseline)
- "ECCD-Bench" is proprietary — not independently reproducible
- Fine-tuning from DeepSeek-R1 raises questions about model-specific optimization

## 8. Production Deployment Insights

This paper provides rare **production evidence** for multi-agent systems:

1. **Smaller models work in production** — Qwen3-4B/8B (not GPT-4 or 70B models) are sufficient with proper fine-tuning
2. **Knowledge distillation from reasoning models** enables deployment-grade inference
3. **Streaming output** is the key UX pattern for hiding multi-agent latency
4. **Users adapt behavior** — 25% more long queries shows users learn to express complex needs when the system can handle them
5. **The value is in complex/consultative scenarios** — simple search doesn't benefit, but decision-heavy queries see 30% conversion lift
6. **A/B testing at scale validates** what offline benchmarks suggest — multi-agent > single-model for complex tasks

## 9. Implications for Our Work

**For Kinos architecture:**
- Clear role delineation (cognitive mapping) prevents agent confusion
- Memory systems are essential for multi-turn coherence
- Production deployment requires model size optimization (not biggest = best)
- Streaming output is table stakes for user-facing multi-agent systems

**For evaluation methodology:**
- ECCD-Bench's three-category split (simple/complex/consultative) is a useful evaluation framework
- Online A/B testing remains the gold standard — offline metrics are necessary but insufficient
- Decision Cost as a metric (interactions per transaction) captures efficiency that accuracy alone misses

---

*Analysis completed 2026-03-13. ~8KB deep-dive.*
