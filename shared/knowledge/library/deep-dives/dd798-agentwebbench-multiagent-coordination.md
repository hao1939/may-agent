# DD#798 — AgentWebBench: Benchmarking Multi-Agent Coordination in Agentic Web

**Paper**: Zhong, Shen & Xiong (2026). "AgentWebBench: Benchmarking Multi-Agent Coordination in Agentic Web." arXiv:2604.10938  
**Relevance**: ★★★★ — Multi-agent coordination benchmark; decentralized information access; coordination failure analysis  
**Date**: 2026-04-21  

---

## Core Contribution

Introduces **AgentWebBench** — a benchmark for the "Agentic Web" paradigm where:
- **User agents** seek information on behalf of users
- **Content agents** manage website data through controlled interfaces
- Information access shifts from centralized retrieval to **decentralized multi-agent coordination**

## Evaluation Setup

- **4 tasks**: Web search, web recommendation, question answering, deep research
- **7 advanced LLMs** tested
- **3 coordination strategies** evaluated
- Covers both ranked retrieval and open-ended synthesis

## Key Findings

1. **Multi-agent coordination lags centralized retrieval** (as expected — user agent can't directly access corpus)
2. **Gap shrinks with model scale** — stronger models coordinate better
3. **Can outperform centralized on QA** — coordination enables richer synthesis
4. **Traffic concentration**: Decentralized access concentrates toward small set of websites (power law)
5. **Test-time scaling helps**: More computation → better interaction reliability AND task performance
6. **Planning is critical**: Strong results require sufficient interactions guided by careful planning

## Failure Analysis

- **User agents** need: better planning, better answer synthesis
- **Content agents** need: more reliable retrieval, better evidence quality
- Coordination failures stem from insufficient interaction rounds and poor planning

## Relevance to Our System

**Moderate** — the decentralized coordination pattern maps to:
- Our multi-agent architecture where specialized agents (Scout, Builder, etc.) each control their own knowledge/tools
- The "user agent can't directly access corpus" constraint = how our orchestrator relies on specialized agents
- Planning failures = our observed coordination issues in complex workflows

The finding that **capability scaling helps coordination** aligns with DD#793's inverse finding (more capable → less cooperative in zero-cost games) — suggesting coordination improvement from scaling is task-dependent.

## Limitations

- Web-specific setting may not generalize to other multi-agent domains
- Content agents are simulated (not real deployed systems)
- Limited adversarial scenarios (no deceptive content agents)
- Only 3 coordination strategies tested

## Cross-References

- DD#793 More Capable, Less Cooperative: Contrasting finding — scaling helps coordination here but hurts cooperation there (task structure matters)
- DD#791 HORIZON: Both provide failure taxonomies for agent systems
- DD#788 AgenTracer: Failure attribution in multi-agent systems
