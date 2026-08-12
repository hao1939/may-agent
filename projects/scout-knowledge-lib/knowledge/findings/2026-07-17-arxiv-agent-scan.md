<ai_context>arXiv cs.AI scan from July 16-17 2026 covering multi-agent search state management, cost-aware security agent evaluation, and automated meta-analysis. Relevant when discussing: search agent architectures, explicit shared state in multi-agent systems, security agent benchmarking, evidence synthesis automation.</ai_context>

# arXiv Agent Scan — 2026-07-17

## SearchOS-V1: Robust Open-Domain Information-Seeking Agent Collaboration

**Source:** https://arxiv.org/abs/2607.15257v1  
**Published:** 2026-07-16  
**Authors:** Zhang, Gao, Wu, Fan, et al.  
**Code:** https://github.com/antins-labs/SearchOS

**Summary:** SearchOS is a multi-agent framework that externalizes implicit search progress into explicit, persistent, shared state. It formulates open-domain information seeking as *relational schema completion with grounded citations* — agents discover entities, populate attribute tables, and anchor values to source evidence.

**Key mechanisms:**
- **Search-Oriented Context Management (SOCM):** Maintains four structures — Frontier Task queue, Evidence Graph, Coverage Map, and Failure Memory.
- **Pipeline-parallel scheduling:** Overlaps sub-agent execution, continuously refilling freed slots with unresolved coverage gaps.
- **Search Tool Middleware Harness:** Intercepts model/tool interactions to record grounded evidence and react to stalls or budget exhaustion.
- **Hierarchical skill system:** Strategy + access skills prevent repeating failed search patterns across runs.

**Implication:** Directly validates the "externalize state" pattern we've tracked. The Coverage Map + Failure Memory combo is a concrete implementation of anti-loop mechanisms. The schema-completion framing turns vague "find info" tasks into structured, measurable progress.

**Connects to:** multi_agent_coordination, the-session-floor, agent-architectures-research

---

## Beyond Success Rate: Cost-Aware Evaluation of Security Agents

**Source:** https://arxiv.org/abs/2607.15263v1  
**Published:** 2026-07-16  
**Authors:** Kassianik, Nelson, Singer (Frontier Security)

**Summary:** Evaluates LLM security agents through a cost-success lens on offensive (Cybench CTF) and defensive (Splunk BOTS v1 SOC) tasks. Decomposes performance by inference spend vs. tool spend at fixed cost levels.

**Key findings:**
- Offensive CTF performance scales with test-time compute; open-weight models approach frontier proprietary at same cost.
- Defensive SOC investigation does **not** scale with more reasoning budget — success depends on disciplined tool use, telemetry navigation, and selective enrichment.
- Red-team vs blue-team tasks have *distinct scaling regimes*.

**Implication:** The red/blue asymmetry is striking. More thinking helps attack but not defense. For defensive agents, architecture (tool discipline, state management) matters more than raw model capability. Reinforces the "agent architecture > model scale" thesis for structured operational tasks.

**Connects to:** agent-evaluation-trends-updated, the-evaluation-mirage

---

## AutoSynthesis: Agentic Automated Meta-Analysis

**Source:** https://arxiv.org/abs/2607.15247v1  
**Published:** 2026-07-16  
**Authors:** Taherinezhad, Maier, Vitagliano, Pierri, Feuerriegel

**Summary:** End-to-end multi-agent system for quantitative evidence synthesis. Given a research question, it formulates search strategy, retrieves literature, screens studies, assesses eligibility, extracts statistics, computes effect sizes, and runs random-effects meta-analysis. Produces PRISMA-aligned reports.

**Key result:** Pooled effect estimates achieve close agreement with expert-conducted meta-analyses (similar Hedges' g). Screened 28+ studies, extracted 20+ quantitative claims.

**Implication:** Shows multi-agent pipelines can replicate expert-level structured analytical workflows. The pipeline decomposition (search → screen → extract → compute → report) is a clean example of specialized-agent-per-stage architecture working in practice.

**Connects to:** agent-architectures-research, multi_agent_trends
