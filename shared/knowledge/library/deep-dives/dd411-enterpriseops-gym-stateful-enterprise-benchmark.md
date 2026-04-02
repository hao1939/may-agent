# Deep-Dive #411: EnterpriseOps-Gym — Stateful Enterprise Benchmark Reveals Planning as Primary Agent Bottleneck

**Paper:** "EnterpriseOps-Gym: Environments and Evaluations for Stateful Agentic Planning and Tool Use in Enterprise Settings"
**ArXiv:** 2603.13594
**Authors:** Shiva Krishna Reddy Malay*, Shravan Nayak*, Jishnu Sethumadhavan Nair, Sagar Davasam, Aman Tiwari, Sathwik Tejaswi Madhusudhan, Sridhar Krishna Nemala, Srinivas Sunkara, Sai Rajeswar (*Equal contribution)
**Affiliation:** ServiceNow Research, Mila – Quebec AI Institute, Université de Montréal
**Date Filed:** 2026-03-13
**Reviewed:** 2026-03-17
**Relevance:** ★★★★☆ — Major enterprise agent benchmark; validates coordination ceiling thesis; surfaces refusal-as-safety failure mode

---

## 1. Problem Statement

Enterprise agent benchmarks systematically fail to capture the complexity of professional workflows because they:
- **Lack persistent state**: Most benchmarks treat each task as stateless; real enterprise work involves sequential actions that permanently modify shared databases
- **Under-scale toolkits**: Prior benchmarks offer 10-50 tools; real enterprise environments expose hundreds, creating search friction
- **Ignore access governance**: Enterprise operations require compliance with internal policies (privacy, approvals, access controls) that constrain valid action sequences
- **Skip infeasibility detection**: Real enterprise requests are often impossible, ambiguous, or policy-violating — agents must refuse, not hallucinate actions

**Core gap:** No benchmark simultaneously tests long-horizon stateful planning, massive tool search, policy compliance, and safe refusal in a unified, realistic enterprise environment.

## 2. EnterpriseOps-Gym Architecture

### 2.1 Scale
- **512 functional tools** across 8 enterprise domains (containerized MCP servers)
- **164 relational database tables** with realistic enterprise data
- **1,150 expert-curated tasks** spanning 8 mission-critical verticals
- **Containerized sandbox** — each evaluation runs in isolated Docker environments with persistent state

This is **an order of magnitude larger** than prior enterprise benchmarks (e.g., WorkArena ~30 tools, CRMArena ~20 tools).

### 2.2 Eight Enterprise Domains
1. **Teams** — messaging, channel management
2. **CSM** (Customer Service Management) — ticket workflows
3. **Email** — composition, routing, thread management
4. **ITSM** (IT Service Management) — incident/change management
5. **Calendar** — scheduling, conflict resolution
6. **HR** — employee records, policy compliance
7. **Drive** — document management, permissions
8. **Hybrid** — cross-domain orchestration (the hardest category)

### 2.3 Verification: SQL-Based Outcome Checking
Unlike soft LLM-as-a-judge or action-trace matching:
- **Hidden expert-authored SQL scripts** verify final database state
- Binary pass/fail: ALL verification conditions must be met
- Tests *outcome correctness*, not process correctness — agents can solve however they want, but the database must end in the right state
- This is a much harder criterion than trajectory matching

### 2.4 Infeasibility Testing
Dedicated subset of **infeasible tasks** where the correct answer is to refuse:
- Policy violations (unauthorized data access)
- System constraint violations (impossible state transitions)
- Agents must identify and decline rather than hallucinate solutions
- Measures **safety reasoning** as a first-class metric

## 3. Key Results

### 3.1 Overall Performance (14 Frontier Models)
| Model | Avg Success Rate |
|-------|-----------------|
| Claude Opus 4.5 (best) | **37.4%** |
| GPT-5 | ~33% (estimated from rankings) |
| Others | Declining from there |

**Critical finding:** The best frontier model achieves only 37.4% on realistic enterprise tasks. This is *before* multi-agent orchestration — single-agent performance.

### 3.2 Oracle Plan Uplift
When agents receive **oracle human-written plans** (step-by-step instructions):
- Performance improves by **14-35 percentage points**
- This is enormous — it means the primary bottleneck is **strategic reasoning/planning**, NOT tool use or execution

**Implication:** The execution machinery (tool calling, API formatting, response parsing) works adequately. What fails is the *planning* — decomposing a high-level business request into a correct sequence of stateful operations.

### 3.3 Infeasibility/Refusal Performance
- Best model achieves only **53.9%** on infeasible task detection
- This means ~46% of the time, the best model attempts to execute impossible/harmful requests
- Failure modes: fabricating solutions, making unauthorized modifications, hallucinating tool results

### 3.4 Cross-Domain (Hybrid) Tasks
Hybrid tasks requiring coordination across multiple enterprise domains are significantly harder:
- Requires understanding which domain's tools to use
- Must maintain state consistency across domains
- Represents the true enterprise workflow complexity

## 4. Why This Matters for Multi-Agent Systems

### 4.1 Coordination Ceiling Validation
The 37.4% best-case single-agent performance is **remarkably close** to the ~45% coordination ceiling documented in CR#75 (Empirical Coordination Ceiling). This suggests:
- Enterprise environments are complex enough that they naturally hit the coordination ceiling even for single agents
- Multi-agent orchestration over EnterpriseOps-Gym would likely reveal even sharper ceilings due to stateful interference
- The gap between capability and performance is architectural, not parametric

### 4.2 Planning-Execution Decomposition
The oracle plan experiment creates a clean **planning vs. execution decomposition**:
- Execution alone: ~52-72% success (with oracle plans)
- Planning + Execution: 37.4% (best model, no oracle)
- **Planning accounts for 14-35 percentage points of loss**

This directly supports the deliberation-first thesis from DD#378 (DOVA): meta-reasoning before action is essential, and reflexive tool invocation fails in complex environments.

### 4.3 Refusal-as-Safety Gap
The 53.9% infeasibility detection rate exposes a critical safety gap:
- In multi-agent systems, one agent's failure to refuse can propagate harmful actions across the team
- Connects to DD#295 (AgentDrift) — tool corruption patterns where agents execute harmful operations
- Connects to DD#408 (ILION) — deterministic execution gates needed precisely because agents can't self-police

### 4.4 Search Friction as Realistic Constraint
512 tools create genuine **search friction** — agents must navigate a large action space to find relevant tools. This is analogous to:
- DD#287 (ToolTree) — MCTS for tool planning in large action spaces
- CR#105 (Domain-Specific Tool Advantage) — specialized tools outperform general-purpose ones

## 5. Connections to Portfolio

| Reference | Connection |
|-----------|-----------|
| **CR#75** (Coordination Ceiling) | 37.4% ≈ ceiling threshold; enterprise complexity naturally triggers it |
| **DD#378** (DOVA) | Oracle plan uplift validates deliberation-first orchestration |
| **DD#286** (STAR) | Both benchmark strategic reasoning; STAR in adversarial games, EnterpriseOps in enterprise |
| **DD#295** (AgentDrift) | Refusal failure → harmful side effects; same unsafe execution pattern |
| **DD#408** (ILION) | Deterministic gates needed because 46% refusal failure rate |
| **DD#287** (ToolTree) | 512-tool search friction demands structured planning, not linear search |
| **CR#110** (Empirical Failure Convergence) | Another data point in the ~40% performance convergence pattern |

## 6. Limitations & Critique

1. **Single-agent only**: Paper evaluates individual models, not multi-agent teams. A natural extension is testing orchestrated multi-agent systems on EnterpriseOps-Gym — likely to show the coordination ceiling even more sharply.
2. **ServiceNow ecosystem**: The 8 domains closely mirror ServiceNow's product suite, which may introduce domain bias. Generalization to other enterprise platforms (Salesforce, SAP, etc.) is untested.
3. **ReAct-only scaffolding**: All models evaluated in a stateful ReAct loop. More sophisticated scaffolding (tree search, planning modules, deliberation layers) could improve results.
4. **No cost analysis**: Paper doesn't report token costs or latency, which are critical for enterprise deployment viability.

## 7. Key Takeaway

**Strategic planning is the primary bottleneck for enterprise AI agents.** When given oracle plans, execution improves by 14-35 percentage points — meaning tool use largely works but agents can't figure out *what to do* in complex, stateful environments. Combined with a 46% failure rate on detecting infeasible tasks, this paints a picture of agents that are competent executors but dangerous planners. For multi-agent systems, this implies that orchestration and planning layers (not just better individual agents) are the critical architectural investment.

---

*Filed by Scout, 2026-03-17. DD#411. Benchmark paper.*
