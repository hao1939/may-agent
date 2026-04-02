# Deep-Dive: Verified Multi-Agent Orchestration (VMAO) (arXiv:2603.11445)

**Paper:** "Verified Multi-Agent Orchestration: A Plan-Execute-Verify-Replan Framework for Complex Query Resolution"  
**Authors:** Xing Zhang, Yanwei Cui, Guanghui Wang, Qucy Wei Qiu, Ziyuan Li, Fangwei Han, Yajing Huang, Hengzhi Qiu, Bin Zhu, Peiyang He  
**Affiliations:** AWS Generative AI Innovation Center + HSBC  
**Venue:** arXiv:2603.11445v1 (March 12, 2026) — ICLR 2026 Workshop submission  
**Rating:** ★★★★★ CRITICAL  
**Date Analyzed:** 2026-03-13

---

## Executive Summary

VMAO introduces a Plan-Execute-Verify-Replan loop for coordinating specialized LLM agents on complex queries. The key innovation is **orchestration-level verification** — using an independent LLM verifier to assess whether *collective* agent outputs satisfy the original query, then triggering adaptive replanning when gaps are detected. On 25 market research queries, VMAO improves answer completeness from 3.1→4.2 and source quality from 2.6→4.1 (1-5 scale) vs single-agent baseline. This is the first production-oriented framework to formally separate verification from execution at the orchestration layer.

---

## Core Architecture

### Five-Phase Loop
1. **Plan** — QueryPlanner decomposes query into DAG of sub-questions with agent assignments, dependencies, priorities
2. **Execute** — DAGExecutor orchestrates parallel execution respecting dependency ordering (wave-based scheduling)
3. **Verify** — ResultVerifier evaluates completeness per sub-question via independent LLM (Opus 4.5 verifying Sonnet 4.5 execution)
4. **Replan** — AdaptiveReplanner generates retries or new sub-questions for identified gaps
5. **Synthesize** — Final answer construction with hierarchical synthesis for large result sets

### Agent Taxonomy (Three Tiers)
| Tier | Role | Agents | Tools |
|------|------|--------|-------|
| **Tier 1: Data** | Information retrieval | RAG (13 tools), Web Search (4), Financial (7), Competitor (11) | 35 tools |
| **Tier 2: Analysis** | Reasoning over data | Analysis (20), Reasoning (24), Raw Data (1) | 45 tools |
| **Tier 3: Output** | Deliverable generation | Document (4), Visualization (6) | 10 tools |

Total: 8 agents, 42 unique tools across 8 MCP servers.

---

## Key Technical Contributions

### 1. DAG-Based Query Decomposition
- Complex queries → directed acyclic graph of sub-questions
- Each node: `{id, question, agent_type, dependencies, priority, context_from_deps, verification_criteria}`
- **Automatic context propagation** — results from upstream nodes prepended to downstream queries
- Wave-based parallel execution: independent nodes execute concurrently, dependent nodes in subsequent waves
- Default max concurrency k=3

### 2. Verification-Driven Replanning
- **Independent verification model** — Uses Claude Opus 4.5 (different, more capable model) to evaluate Sonnet 4.5 execution outputs
- Per-result assessment: status (complete/partial/incomplete), completeness score (0-1), missing aspects, contradictions, recommendation (accept/retry/escalate)
- **Result preservation** — Previous results stored and merged with retry attempts, enabling progressive refinement
- **Replanning logic:**
  - completeness > 0.8 → proceed to synthesis
  - Incomplete results → retry ALL incomplete sub-questions
  - completeness 0.5-0.8 → add new gap-filling sub-questions
  - Contradictions → add queries targeting different sources
  - iterations ≥ max → force stop

### 3. Configurable Stop Conditions (5 criteria)
| Condition | Default Threshold | Rationale |
|-----------|-------------------|-----------|
| Ready for Synthesis | 80% complete | Sufficient coverage |
| High Confidence | 75% conf + 50% complete | Reliable despite partial |
| Diminishing Returns | <5% improvement | Further iteration futile |
| Token Budget | 1M tokens | Hard cost limit |
| Max Iterations | 3 | Hard iteration limit |

**Critical finding:** >75% of queries terminate via resource-based conditions (diminishing returns, max iterations, token budget), not quality-based conditions — suggesting conservative thresholds prioritize thoroughness.

---

## Experimental Results

### Main Comparison (25 market research queries)
| Method | Completeness | Source Quality | Avg Tokens | Avg Time (s) |
|--------|-------------|---------------|------------|-------------|
| Single-Agent | 3.1 | 2.6 | 100K | 165 |
| Static Pipeline | 3.5 | 3.2 | 350K | 420 |
| **VMAO** | **4.2** | **4.1** | 850K | 900 |

**Key observations:**
- 35% completeness improvement, 58% source quality improvement vs single-agent
- 8.5× token cost increase (100K → 850K)
- 5.5× latency increase (165s → 900s)
- Token distribution: Execution 61%, Verification ~15%, Synthesis ~10%, Planning ~14%

### Category-Level Performance
- **Strategic Assessment:** +53% completeness (largest gain) — open-ended, multi-dimensional queries benefit most
- **Performance Analysis:** Modest gains — well-defined data sources accessible even to single agents
- **Key insight:** Verification most valuable when query space is hard to characterize upfront

### Replanning Analysis
- Majority of replanning = retries of incomplete sub-questions (not new questions)
- **Agent execution variance** (tool failures, insufficient search) > poor initial decomposition as gap source
- This means the planner is reasonably good; the problem is execution reliability

---

## Critical Analysis

### Strengths
1. **Clean separation of concerns** — Planning, execution, verification, and replanning as distinct phases enables modularity
2. **Independent verification model** — Using Opus 4.5 to verify Sonnet 4.5 reduces self-evaluation bias (though same model family)
3. **Progressive refinement** — Result preservation across retries avoids losing earlier findings
4. **Production-oriented** — Timeouts, token budgets, fallback models, SSE streaming for frontend
5. **Explicit stop conditions** — Configurable quality-cost tradeoffs rather than unbounded iteration

### Weaknesses
1. **Small evaluation set** — 25 queries, no confidence intervals reported
2. **Same model family for eval** — Opus/Sonnet both Claude; shared biases possible despite human review (<15% adjustments)
3. **No ablation** — Cannot isolate contribution of verification vs. DAG decomposition vs. parallel execution
4. **Completeness ≠ accuracy** — Verifier confirms claims are present and sourced but cannot establish truth
5. **Cost-prohibitive for many settings** — 8.5× token cost may be unjustifiable outside high-value research tasks
6. **Single domain** — Only market research; transferability claimed but untested

### Limitations the Authors Acknowledge
- LLM verifier may miss subtle factual errors or hallucinations
- Poor query decomposition propagates errors downstream (verifier may accept well-sourced but irrelevant answers)
- Single model family tested (Claude only)

---

## Framework Connections

### Connection to Our Coordination Theory
VMAO provides **empirical evidence for several framework principles:**

1. **Verification as coordination signal** — Aligns with our finding that orchestration-level quality assessment is more effective than agent-level self-evaluation (connects to evaluator reliability synthesis)
2. **DAG decomposition ↔ Static analysis** — The dependency graph is essentially static workflow analysis; the replanning loop adds dynamic adaptation
3. **Progressive refinement ↔ Conversation dynamics** — Multi-iteration refinement with result preservation parallels our findings on multi-turn improvement patterns
4. **Stop conditions ↔ Resource-bounded rationality** — The 5-criterion stop condition framework operationalizes the quality-cost tradeoff we identified

### Connection to LM Teams as Distributed Systems (2603.12229)
- VMAO's DAG execution is a **specific implementation** of the distributed systems perspective
- The verification-driven replanning is a form of **consensus mechanism** — the verifier acts as a leader determining collective output acceptability
- Token budget as a hard stop ↔ **bounded computation** in distributed systems

### Connection to Reward Hacking (2603.11337)
- VMAO's separation of execution model (Sonnet) and verification model (Opus) is a **partial mitigation** against reward hacking
- However, both models are from the same family — the "different model for eval" approach only partially addresses self-evaluation bias
- Our framework predicts this: same-family evaluation has correlated failure modes

### Connection to AgenticCyOps (2603.09134)
- VMAO's tiered agent taxonomy (Data → Analysis → Output) parallels AgenticCyOps' functional decomposition
- Both use MCP for tool integration — emerging as standard protocol for multi-agent tool access
- VMAO lacks security-specific controls that AgenticCyOps provides (no threat monitoring, no adversarial resilience)

### Connection to Multi-Agent Memory (2603.10062)
- VMAO's "context propagation" through DAG dependencies is a **simple memory architecture** — upstream results as context for downstream agents
- No persistent memory across queries — each query starts fresh
- Missing: The memory consistency guarantees that the computer architecture perspective demands

### Connection to LDP Protocol (2603.08852)
- VMAO doesn't address identity/authentication — all agents trusted by default
- LDP's identity verification would strengthen VMAO for adversarial settings
- VMAO's verification is about *quality*, not *identity* — complementary concerns

---

## Key Metrics & Formulas

- **Completeness threshold:** 80% of sub-questions answered → proceed to synthesis
- **Token efficiency:** ~850K tokens/query for full orchestration
- **Verification overhead:** ~15% of total token budget
- **Replanning effectiveness:** Majority retries (execution variance) rather than new decomposition
- **Human-LLM agreement:** <15% of LLM scores adjusted by human reviewers (±0.5 points)

---

## Quotes & Key Passages

> "Orchestration-level verification—where an independent model evaluates whether collective agent results satisfy the original query—is an effective coordination mechanism for multi-agent systems."

> "The majority of replanning actions are retries of incomplete sub-questions rather than introduction of entirely new ones, indicating that agent execution variance (tool failures, insufficient search results) is a larger contributor to gaps than poor initial decomposition."

> "LLM-based verification may miss subtle factual errors or hallucinations, as it evaluates completeness rather than accuracy."

---

## Impact Assessment

**For our framework:** VMAO provides the **strongest empirical evidence yet** for verification-driven coordination in production multi-agent systems. The finding that execution variance > planning errors as the primary gap source is novel and important — it means the bottleneck is reliable tool use, not intelligent decomposition.

**For the field:** First principled framework combining DAG decomposition + independent verification + configurable stop conditions. The production engineering details (MCP integration, fallback models, SSE streaming) make this immediately applicable.

**Limitation for generalization:** Market research is a relatively forgiving domain — no safety-critical decisions, no adversarial inputs, no real-time constraints. The 8.5× cost and 5.5× latency would be prohibitive in many settings.
