# Deep-Dive: An Empirical Study of Bugs in Modern LLM Agent Frameworks

**Paper:** arXiv:2602.21806v3  
**Authors:** Xinxue Zhu et al. (Nantong U, Nanjing U, NTU Singapore, Beihang, UMass Amherst, Xi'an Jiaotong)  
**Date:** February 27, 2026  
**Venue:** FSE '26 (Foundations of Software Engineering)  
**Scout Analysis Date:** 2026-03-13

---

## 1. Core Contribution

First **lifecycle-oriented empirical study** of bugs in LLM agent frameworks, analyzing **998 bug reports** from CrewAI and LangChain. Constructs a taxonomy of **15 root causes** and **7 symptoms** mapped across **5 agent lifecycle stages**, revealing where and why framework-level bugs occur.

Key distinction: This studies **framework-level bugs** (infrastructure), not **agent-level failures** (reasoning/planning errors). The bugs live in the plumbing, not the intelligence.

---

## 2. Methodology

### Data Collection
- **998 bug reports** from CrewAI (multi-agent role-based) and LangChain (tool/pipeline orchestration)
- Combined 68.5K GitHub stars
- Period: December 2023 – January 2026
- Two-stage filtering: label-based ("bug" tag) → manual inspection
- Started with 2,773 issues → refined to 998

### Labeling Process
- Two independent annotators with SE/LLM experience
- Initial taxonomy from 100 random samples → applied to remaining 898
- Cross-checked for consistency
- Mapped to 5 agent lifecycle stages

---

## 3. The 5 Agent Lifecycle Stages

1. **Agent Initialization** — Setup, capability registration, parameter configuration (36/998 = 3.6%)
2. **Perception** — Input processing, environmental sensing (18/998 = 1.8%)
3. **Self-Action** — Planning, scheduling, tool invocation, graph execution (**882/998 = 88.4%** ← DOMINANT)
4. **Mutual Interaction** — Multi-agent delegation, shared state coordination (53/998 = 5.3%)
5. **Evolution** — Memory updating, experience accumulation, adaptation (9/998 = 0.9%)

### 🔴 Critical Finding: 88.4% of bugs occur in Self-Action stage

---

## 4. Root Cause Taxonomy (15 categories)

### Top 3 Root Causes (55.3% of all bugs):
| Root Cause | Count | % | Description |
|---|---|---|---|
| **API Misuse** | 329 | 32.97% | Developers misunderstand execution abstractions, control-flow design, lifecycle semantics |
| **API Incompatibility** | 223 | 22.34% | API changes alter execution semantics, breaking agent logic assumptions |
| **Documentation Desync** | 75 | 7.51% | Documented behavior ≠ actual behavior, misleading developers |

### Other Notable Root Causes:
| Root Cause | Count | Description |
|---|---|---|
| Streaming Instability | 67 | Streaming mechanisms lose sync or terminate prematurely |
| Configuration Misalignment | 53 | Runtime config violates framework assumptions |
| Serialization Error | 53 | Fails to encode/decode agent state, plans, tool-call messages |
| Dependency Environment Inconsistency | 35 | Software stack conflicts prevent agent runtime init |
| Telemetry Malfunction | 32 | Logging/tracing interferes with execution flow |
| Memory Persistence Bug | 30 | Inconsistent long-term state across iterations |
| Knowledge Transmission Issue | 21 | Multi-agent context propagation failures |
| Execution Isolation | 20 | Sandboxing conflicts with tool execution |
| Concurrency Behavior Confusion | 20 | Async execution semantics misinterpreted |
| Console Interaction Issue | 15 | Interactive assumptions misaligned with runtime |
| Frontend-Backend Mismatch | 7 | UI/monitoring inconsistent with backend state |

---

## 5. Symptom Taxonomy (7 categories)

| Symptom | Count | % | Description |
|---|---|---|---|
| **Functional Error** | 781 | 78.3% | System runs but produces wrong outcomes |
| **Crash** | 100 | 10.0% | Framework terminates unexpectedly |
| **Build Failure** | 67 | 6.7% | Installation/startup breaks before execution |
| Display Anomaly | 19 | 1.9% | Misleading logging/visualization |
| Hang | 17 | 1.7% | Execution stops without error |
| Poor Performance | 10 | 1.0% | Degraded response time/throughput |
| Unreported | 4 | 0.4% | Silent misbehavior, no failure signal |

### 🔴 78.3% of bugs manifest as Functional Errors — the system keeps running but behaves wrong. These are the hardest to detect.

---

## 6. Key Findings & Patterns

### Finding 1: Execution Semantics Are the Dominant Bug Source
- **55.3%** of all bugs come from API Misuse + API Incompatibility
- These concentrate overwhelmingly in Self-Action stage
- Root cause: developers' mental models don't match framework execution semantics

### Finding 2: Multi-Agent Interaction Bugs Are Distinct
- Mutual Interaction stage (53 bugs): dominated by API Misuse (20/53) and Streaming Instability (8/53)
- **Knowledge Transmission Issue** specifically emerges in multi-agent settings — frameworks fail to propagate context correctly across agents
- Coordination failures from delegation logic and shared state consistency problems

### Finding 3: Silent Failures Dominate
- 78.3% Functional Errors + 0.4% Unreported = nearly 80% of bugs produce **no obvious crash**
- The framework keeps running with wrong outputs — extremely dangerous for production systems
- Hangs (1.7%) are also insidious — system appears alive but makes no progress

### Finding 4: Evolution Stage Is Underexplored
- Only 9/998 bugs in Evolution stage — but this may reflect immaturity of long-running agent systems
- Memory persistence and adaptive adjustment bugs will likely increase as agents become more persistent

---

## 7. Significance for Multi-Agent Research

### 🔴 Critical Implications

1. **The Infrastructure Problem:** Agent research focuses on reasoning/planning failures, but 88.4% of framework bugs are in *execution mechanics*. Building better agents on buggy infrastructure amplifies failures.

2. **Silent Corruption Is the Dominant Failure Mode:** 78.3% of bugs don't crash — they silently produce wrong results. This means multi-agent coordination failures may often be attributed to "agent intelligence" when they're actually framework bugs.

3. **Multi-Agent Specific Bugs Exist:** Knowledge Transmission Issues (context propagation failures) and Mutual Interaction bugs are distinct categories — multi-agent frameworks have unique failure modes beyond single-agent problems.

4. **API Evolution Is Destructive:** 22.3% of bugs from API Incompatibility means agent systems are fragile to framework updates. Long-running multi-agent deployments face cumulative breakage risk.

5. **Streaming as Coordination Primitive:** Streaming Instability (67 bugs) is especially relevant for multi-agent real-time coordination. Premature termination and sync loss directly break collaborative workflows.

### Cross-References
- **Self-Locking (2603.11779):** Framework-level Hangs map to self-locking states — are some "self-locks" actually framework bugs?
- **Error Cascades (2502.15810):** Silent Functional Errors could initiate cascades that appear to be reasoning failures
- **MAS-FIRE (2602.19843):** Fault injection testing should include framework-level faults, not just agent-level failures
- **TraceSIR (2603.00623):** Execution trace analysis could detect framework bugs vs. agent reasoning failures
- **EmCoop (2603.00349):** EmCoop's dual-layer design could help isolate cognitive failures from embodied/framework failures

### Actionable Insights for System Builders
1. **Separate framework debugging from agent debugging** — most failures are infrastructure, not intelligence
2. **Build silent-failure detection** — monitoring that checks output correctness, not just process liveness
3. **Version-pin all framework dependencies** — API evolution causes 22% of bugs
4. **Test multi-agent context propagation explicitly** — Knowledge Transmission is a distinct failure class
5. **Implement streaming health checks** — streaming instability breaks coordination workflows

---

## 8. Limitations
- Only two frameworks studied (CrewAI + LangChain) — may not generalize to all agent frameworks
- Bug reports represent *reported* issues only — actual bug prevalence may differ
- No severity or impact assessment — a crash is weighted same as a typo-adjacent display anomaly
- Temporal analysis limited — no tracking of how bug patterns evolve over framework versions

---

**Bottom Line:** This paper reveals that the vast majority of LLM agent framework bugs are **silent execution failures in the Self-Action stage**, caused by mismatches between developer expectations and framework execution semantics. For multi-agent systems, this means many "coordination failures" may actually be infrastructure bugs masquerading as intelligence failures. Essential reading for anyone deploying agent frameworks in production.
