# Deep-Dive #328: AgentFuel — Generating Expressive and Customizable Evals for Timeseries Data Analysis Agents

**Paper:** "Generating Expressive and Customizable Evals for Timeseries Data Analysis Agents with AgentFuel"
**ArXiv:** 2603.12483v1 (cs.AI, cs.LG, 12 Mar 2026)
**Authors:** Aadyaa Maddi, Prakhar Naval, Deepti Mande, Shane Duan, Muckai Girish, Vyas Sekar (CMU & Rockfish Data)
**Benchmarks:** https://huggingface.co/datasets/RockfishData/TimeSeriesAgentEvals
**Rating:** ★★★★☆

---

## Executive Summary

AgentFuel addresses a critical gap in agent evaluation: existing benchmarks for data analysis agents (BIRD, Spider2, etc.) focus on tabular/relational data and neglect **domain-specific timeseries data models**. The paper evaluates 6 popular data analysis agents (both open-source and proprietary) on domain-specific timeseries data and finds they **fail on stateful and incident-specific queries**. AgentFuel provides a framework for domain practitioners to generate customized, expressive evaluation suites for timeseries agents, exposing two key expressivity gaps: domain-customized datasets and domain-specific query types.

---

## Core Problem

### The Timeseries Agent Gap

Across IoT, observability, telecom, and cybersecurity, "talk to your data" conversational agents operate on timeseries data models — measurements from sensors, event logs, user click streams, product analytics. These differ fundamentally from tabular/relational data:

1. **Temporal ordering** is semantically meaningful (not just a sortable column)
2. **Statefulness** — queries depend on temporal context ("what happened before the spike?")
3. **Incident-specific patterns** — anomaly detection, root cause analysis, trend changes
4. **Domain-specific aggregations** — rolling windows, seasonality decomposition, rate-of-change

### Expressivity Gaps in Existing Evals

1. **Domain-customized datasets:** Existing benchmarks (BIRD, CondaBench, Spider2, TAPilot) use generic relational schemas. Timeseries domains need domain-specific data models with temporal semantics.
2. **Domain-specific query types:** Beyond SQL-like queries, timeseries agents must handle:
   - Stateful queries (depend on previous context)
   - Incident-specific queries (anomaly-aware)
   - Temporal pattern queries (seasonality, trends, changepoints)
   - Cross-metric correlation queries

### Evaluation of 6 Existing Agents

The paper evaluates 6 agents (Mixpanel, ThousandEyes, Elastic, HexTech, Databricks Genie, OpenAI agent) on domain-specific timeseries tasks and finds:
- **All agents struggle** with stateful queries requiring temporal context
- **Incident-specific queries** expose fundamental architectural limitations
- Agents designed for tabular data fail to reason about temporal patterns

---

## AgentFuel Framework

### Design Philosophy

AgentFuel helps **domain experts** (not ML researchers) create customized evaluation suites:
1. Generate domain-specific timeseries datasets with realistic characteristics
2. Define domain-specific query types with ground truth answers
3. Perform end-to-end functional tests that capture real-world usage patterns
4. Expose actionable improvement directions for agent builders

### Key Capabilities

1. **Customizable data generation:** Domain experts specify:
   - Temporal resolution and span
   - Signal characteristics (seasonality, noise, trends)
   - Anomaly patterns (spikes, dips, level shifts)
   - Multi-metric correlations

2. **Expressive query templates:** Beyond simple aggregations:
   - Temporal reasoning queries ("what happened 24h before the incident?")
   - Comparative queries ("is this metric trending differently from last month?")
   - Root cause queries ("which metrics correlated with the outage?")
   - Stateful queries (building on previous context)

3. **End-to-end functional testing:** Tests the full pipeline from natural language → data retrieval → computation → answer, not just SQL generation accuracy.

### Results with GEPA

The paper provides anecdotal evidence that using AgentFuel benchmarks to identify weaknesses can guide agent improvement. With GEPA (presumably an internal agent), iterating on AgentFuel-exposed weaknesses led to measurable performance improvements.

---

## Significance for Agent Evaluation

### 1. Domain-Specific Evaluation is Necessary
This paper demonstrates that **generic benchmarks miss domain-specific failure modes**. An agent that scores well on BIRD (tabular) may completely fail on timeseries tasks. This supports the broader thesis that evaluation must be multi-dimensional and domain-aware.

### 2. Practitioner-Driven Eval Design
By empowering domain experts (not ML researchers) to create evals, AgentFuel addresses the expertise gap: the people who understand timeseries domains aren't typically the ones designing agent benchmarks.

### 3. Stateful Query Challenge
The finding that agents fail on stateful queries is architecturally significant. Most agent frameworks treat each query independently. Stateful reasoning requires:
- Conversation memory management
- Temporal context tracking
- Incremental computation over previous results

This connects to broader challenges in agent memory and context management.

---

## Connections to Portfolio

### Direct Connections
- **DD#304 (CRYSTAL Step-Level Reasoning Evaluation)** — Both papers address evaluation granularity for agents. CRYSTAL evaluates step-level reasoning; AgentFuel evaluates domain-specific functional correctness. Together they suggest evaluation needs both depth (step-level) and breadth (domain-specific).
- **DD#286 (STAR Benchmark)** — Another evaluation paper. STAR evaluates strategic reasoning under time pressure; AgentFuel evaluates domain data analysis capability. Both expose that agents fail at specific competencies even when generally capable.
- **CR#163 (Evaluation Granularity Ladder)** — AgentFuel fills a rung on the ladder: domain-specific functional evaluation for timeseries agents. It demonstrates that the "generic benchmark" rung is insufficient.

### Thematic Connections
- **DD#316 (Structured Distillation for Agent Memory)** — AgentFuel's stateful query challenge directly relates to agent memory: agents need structured memory to track temporal context across queries.
- **CR#105 (Domain-Specific Tool Advantage)** — AgentFuel demonstrates that domain specificity matters for evaluation just as much as for tools.

---

## Limitations

1. **Timeseries-specific:** Framework is tailored to timeseries — unclear how well the approach generalizes to other domain-specific evaluation needs (e.g., graph data, spatial data).
2. **Anecdotal improvement evidence:** The claim that AgentFuel can improve agent performance is supported only by "anecdotal evidence" — no systematic ablation.
3. **32-page paper:** Extensive but may indicate scope creep; core contribution could be more focused.
4. **No standardized metrics:** While generating evals is valuable, without standardized metrics across domains, cross-comparison remains difficult.

---

## Bottom Line

AgentFuel makes a necessary contribution to agent evaluation by demonstrating that timeseries data analysis agents have domain-specific failure modes invisible to generic benchmarks. The framework empowering practitioners to build custom evals is well-positioned for adoption. The most important finding — that all 6 evaluated agents fail on stateful and incident-specific queries — points to fundamental architectural limitations in current data analysis agents. This paper is more evaluation-focused than architecturally novel, but fills an important gap.
