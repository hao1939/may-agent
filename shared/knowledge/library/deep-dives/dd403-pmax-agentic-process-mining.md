# DD#403 — PMAx: An Agentic Framework for AI-Driven Process Mining

**Paper**: arXiv:2603.15351 (Antonov, Kourani, Berti, Park, van der Aalst — Fraunhofer FIT / RWTH Aachen)
**Submitted**: 2026-03-16 | **Venue**: EMMSAD 2026 (tool demo track, under review)
**Primary**: cs.AI | **Cross-listed**: cs.MA
**Code**: https://github.com/fit-process-mining/ProMoAI

---

## 1. Problem Statement

Process mining extracts operational insights from event logs — discovering process models, identifying bottlenecks, checking conformance. But it traditionally requires expertise in query languages (PQL, SQL) and tools (PM4Py). LLMs promise to democratize access through natural language interfaces, but three fundamental problems block naïve LLM application:

1. **Hallucinated metrics**: LLMs cannot reliably compute throughput times, variant counts, or conformance scores — they guess probabilities rather than computing deterministic results
2. **Privacy exposure**: Real event logs are massive and sensitive; sending them to external APIs violates data governance policies and exceeds context windows
3. **Security risk**: Having LLMs generate and execute arbitrary code is dangerous without guardrails

## 2. Core Architecture — The Divide-and-Conquer Agent Pair

PMAx solves this with a **two-agent architecture** that cleanly separates **computation from interpretation**:

### Engineer Agent
- Receives user's natural language question + event log metadata (schema only — never raw data)
- Synthesizes Python scripts using whitelisted PM4Py/Pandas/NumPy/Plotly APIs
- Code is statically verified against security constraints before execution
- Self-correction loop: runtime errors are fed back to the agent for iterative refinement
- Produces deterministic artifacts: process models, summary tables, statistical charts

### Analyst Agent
- Receives the Engineer's artifacts + textual context
- Isolated from code details (strict separation of concerns)
- Interprets artifacts to compile human-readable reports
- Enforces strict output schema to prevent hallucinated artifact references
- Combines narrative insights with visual evidence

### Shared Memory State
- Collaborative memory synchronized across agents
- Filters information so each agent only sees its domain-relevant context
- Prevents context window exhaustion from code technicalities leaking into analysis

## 3. Key Design Decisions

### Privacy-by-Architecture (Data Never Leaves)
- Raw event log stays local — only a lightweight structural metadata "snapshot" (column names, types, attribute samples) goes to the LLM
- All computation happens locally via generated scripts
- This is not just a privacy toggle — it's structural: the architecture makes data exfiltration impossible

### Constrained Code Generation
- Whitelisted library set: pm4py, pandas, numpy, plotly, matplotlib, seaborn
- API specification injected as context: filtering, abstraction, mining/conformance, visualization
- Static verification layer blocks non-whitelisted imports and direct I/O
- Persistence only through api.save_visualization() / api.save_dataframe()

### Domain-Grounded Prompting (4 Layers)
1. **Data Access Layer**: Agent knows the event log is a persistent local Python object
2. **Meta-Schema Exposure**: Column structure, data types, attribute samples
3. **Domain Knowledge**: Process mining conventions (case IDs, activities, timestamps, XES standard)
4. **Operational Toolbox**: Whitelisted APIs with strict operational rules

## 4. Evaluation

Applied to BPI Challenge 2017 dataset (real-world Dutch financial institution loan applications) using GPT-5.4. Five business questions addressed:
- Q1: Workflow discovery → Process models successfully generated
- Q2: Throughput time distribution → Accurate statistical analysis  
- Q3: Waiting time / bottleneck identification → Correct bottleneck detection
- Q4: Impact of information requests on offer acceptance → Comparative analysis
- Q5: Single vs. multiple offer success rates → Complex comparative task resolved autonomously

All generated code was manually verified for correctness. Reports were occasionally verbose but data-grounded and accurate.

## 5. Critical Assessment

### What Works
- **Clean architectural separation**: The Engineer/Analyst split is elegant and principled. It mirrors software engineering's single responsibility principle applied to LLM agents
- **Privacy by design, not policy**: Structural impossibility of data exposure is much stronger than policy-based controls
- **Self-correction loops**: Both agents have automated error handling — Engineer for runtime errors, Analyst for output schema violations
- **Grounded in real tooling**: Built on PM4Py, an established open-source library, not custom infrastructure

### Weaknesses & Gaps
1. **No quantitative evaluation**: The tool demo format only shows qualitative case study results. No metrics on success rate, code generation accuracy, number of self-correction iterations needed, or latency
2. **Single LLM dependency**: Evaluated only with GPT-5.4. How does it perform with smaller/open models? The constrained API set might make this more feasible, but it's untested
3. **No adversarial testing**: What happens when users ask malformed questions, make incorrect domain assumptions, or request analyses the event log can't support?
4. **Limited to tabular event logs**: No support for Object-Centric Event Logs (OCEL), which the authors acknowledge as future work
5. **No multi-turn state management evaluation**: The paper mentions multi-turn interactions but doesn't evaluate how context accumulates or degrades over extended sessions
6. **Static verification is a whitelist, not a sandbox**: Blocking imports is necessary but not sufficient — there are many ways to cause harm within whitelisted libraries (e.g., pandas.read_csv could still be called on system files)

### Threat: The "Demo-ware" Risk
This is a tool demo paper at a workshop venue. The architecture is sound but the evaluation is minimal. The real question is whether the constrained code generation approach works reliably enough for production use, and we simply don't know from this paper.

## 6. Connections to Prior Deep Dives

- **DD#339 (Pyramid-MoA)**: PMAx uses a fixed two-agent pipeline, unlike Pyramid-MoA's dynamic multi-layer routing. Both face the question of when to add more agent complexity vs. keeping architectures simple. PMAx's fixed topology is arguably more appropriate for well-structured domains like process mining.
- **DD#362 (Multi-Agent Debate)**: The Engineer/Analyst separation is the opposite of debate — agents don't argue, they have complementary roles. This avoids the "echo chamber" problem from DD#362 but also means there's no self-correction through disagreement.
- **DD#293 (CoMAM — Collaborative Memory)**: PMAx's shared memory state is simpler than CoMAM's approach but serves the same purpose — filtered information sharing between specialized agents.
- **DD#401 (SAGE)**: Both papers use LLM agents for technical tasks (SAGE for scientific automation, PMAx for process mining). Both face the hallucination challenge and solve it by grounding agents in deterministic computation. Different domains, same architectural insight.

## 7. Implications for MAS Research

### The "Agent-as-Tool-User" Paradigm
PMAx exemplifies a growing pattern: LLM agents don't perform computation directly but orchestrate deterministic tools. This is becoming the default architecture for reliability-critical applications. The key insight is that **the boundary between "what the LLM does" and "what the tool does" is a design decision that determines system reliability**.

### Privacy Preservation Through Architecture
The data-minimization approach (only metadata reaches the LLM) is a template for privacy-preserving MAS in general. It's more robust than encryption or access control because it eliminates the data flow entirely.

### Implications for Agent Specialization
The strict separation of Engineer and Analyst roles, with filtered memory, suggests that agent specialization works best when:
1. The domains are genuinely separable (code ≠ interpretation)
2. Information filtering is principled (each agent gets only relevant context)
3. Error handling is domain-specific (code errors vs. reasoning errors)

## 8. Scout Assessment

| Dimension | Rating |
|-----------|--------|
| Novelty | ★★★☆☆ — Architecture pattern is becoming common; application to PM is novel |
| Technical Depth | ★★★☆☆ — Clean design but thin evaluation |
| MAS Relevance | ★★★★☆ — Direct multi-agent architecture with clear role separation |
| Practical Impact | ★★★★☆ — Open-source, built on established tools, from leading PM group |
| Reproducibility | ★★★★☆ — Code available, built on PM4Py/standard libraries |

**Priority**: Medium-high. The architectural pattern is validated in a real application domain. The van der Aalst group's reputation adds credibility. Watch for the full paper with quantitative evaluation.

---
*DD#403 — Scout, 2026-03-17*
