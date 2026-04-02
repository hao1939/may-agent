# Deep-Dive #391: Language Model Teams as Distributed Systems

**Paper:** arXiv:2603.12229
**Authors:** Elizabeth Mieczkowski, Katherine M. Collins, Ilia Sucholutsky, Natalia Vélez, Thomas L. Griffiths
**Institutions:** Princeton University, MIT, Cambridge, NYU
**Date:** 2026-03-12
**Scout Session:** 2026-03-17
**Portfolio Coverage:** Theory, Architecture, Coordination, Scaling, Infrastructure

---

## 1. EXECUTIVE SUMMARY

This Princeton-led paper establishes the first rigorous formal correspondence between LLM multi-agent teams and distributed computing systems, then empirically validates six key predictions from distributed systems theory. The core thesis: LLM teams inherit the fundamental advantages AND challenges of distributed systems, including Amdahl's Law scaling limits, consistency conflicts, coordination overhead, straggler vulnerability, and cost-efficiency tradeoffs. This isn't analogy — it's structural isomorphism with empirical validation across three LLM families (Claude-Sonnet-4.6, Gemini-3-Flash, GPT-5.2).

**Key findings:**
- **Amdahl's Law accurately predicts LLM team scalability** — speedup limited by serial fraction, with parallel tasks achieving 3.35× and serial tasks gaining essentially nothing
- **Decentralized teams achieve median 0.88× speedup** (SLOWER than single agent) due to consistency conflicts and O(n²) communication overhead
- **Centralized (preassigned) teams achieve median 1.36× speedup** but are vulnerable to stragglers
- **Token cost consistently outpaces speedup** — decentralized 5-agent serial teams use 6.24× tokens for 0.65× speedup
- **Three types of consistency violations** empirically observed: concurrent writes, rewrites, temporal dependency violations

**Verdict:** ★★★★★ CRITICAL. This is the most theoretically grounded LLM team scaling paper in our portfolio. It converts trial-and-error team design into principled engineering by importing decades of distributed systems theory. The empirical validation across three frontier models makes the correspondence actionable, not merely suggestive.

---

## 2. THE STRUCTURAL CORRESPONDENCE

### Four Shared Properties (Formally Established)

The paper identifies four properties that create structural isomorphism between LLM teams and distributed systems:

| Property | Distributed System | LLM Team |
|----------|-------------------|----------|
| **Independence** | Nodes have local memory, no global clock | Agents have local context, partial observability |
| **Communication** | Nodes exchange packets | Agents exchange messages (natural language) |
| **Concurrency** | Parallel execution on shared data | Simultaneous agent work on shared artifacts |
| **Fallibility** | Crashes, corrupted results | Hallucinations, stalls, incorrect outputs |

### Where the Analogy Breaks (Acknowledged)
- Communication in LLM teams uses **natural language** (ambiguous, pragmatic) vs. formal protocols
- Failure modes are **semantic and probabilistic** vs. well-defined crash/Byzantine models
- The paper argues these mismatches are *informative* rather than undermining — gaps reveal where new theory is needed

---

## 3. EXPERIMENTAL DESIGN

### Tasks
Three collaborative coding tasks:
1. Math utilities library implementation
2. Simulated data analysis pipeline
3. SVG file rendering

Each task had 20 subtasks with three dependency structures:
- **Highly parallel**: 18 independent, 2 serial
- **Mixed**: 10 in a dependency chain, 10 independent
- **Highly serial**: 16 interdependent

### Team Configurations
- **Agents:** 1, 2, 3, 4, or 5 homogeneous agents
- **Models:** Claude-Sonnet-4.6, Gemini-3-Flash, GPT-5.2
- **Experiment 1 (Centralized):** Tasks pre-assigned to agents
- **Experiment 2 (Decentralized):** Agents self-coordinate, choose own tasks

---

## 4. KEY RESULTS

### 4.1 Amdahl's Law Predicts LLM Team Scalability

**S_latency(s) = 1 / ((1-p) + p/s)** where p = parallelizable fraction

- Speedup differed significantly across parallelizability conditions (Kruskal-Wallis H=61.4, p<0.001)
- Pairwise ordering confirmed: p_0.9 > p_0.5 > p_0.2 (all p<0.001)
- Even parallel tasks plateau **significantly below** Amdahl bound (median 2.19×, p<0.001)
- Exception: Claude Sonnet 4.6 alone did NOT plateau below bound (p=0.45)

**Best results (preassigned, parallel):**
| Model | 2 agents | 3 agents | 5 agents |
|-------|----------|----------|----------|
| Claude | 1.80× | 2.42× | 3.35× |
| Gemini | 0.59× | 1.13× | 1.14× |
| GPT-5.2 | 1.12× | 1.60× | 1.36× |

**Critical finding:** Gemini-3-Flash and GPT-5.2 show diminishing or negative returns from scaling, even on parallel tasks. Only Claude consistently benefits.

### 4.2 Decentralized Teams Are Slower Than Single Agents

- Preassigned median speedup: **1.36×**
- Decentralized median speedup: **0.88×** (SLOWER)
- Mann-Whitney U=155523, p<0.001
- Pattern holds within each model (all p≤0.01)

### 4.3 Three Consistency Violations

Decentralized teams exhibit:
1. **Concurrent writes** — two+ agents edit same file simultaneously, silently overwriting
2. **Rewrites** — agent completely overwrites teammate's prior file
3. **Temporal dependency violations** — agent implements task before predecessor completes

Consequences: Median 19 test failures (decentralized) vs. 4 (preassigned), Mann-Whitney p<0.001

### 4.4 Communication Overhead Compounds with Team Size

- Decentralized teams exchange significantly more messages (U=311551, p<0.001)
- Message counts increase with team size (r=0.483, p<0.001)
- More idle rounds in decentralized teams (U=289672, p<0.001)
- **O(n²) communication channels** in decentralized vs. O(n) in centralized

### 4.5 Straggler Mitigation

- Preassigned teams have larger straggler gaps (median 2.64s vs 1.42s, p<0.001)
- Effect worsens with team size in both modes
- Mixed/serial tasks amplify straggler impact (H=137.5, p<0.001)
- **Key tradeoff:** decentralized teams mitigate stragglers but introduce consistency and overhead costs

### 4.6 Token Cost vs. Speedup

The devastating cost-efficiency finding:

| Condition | Median Token:Speedup Ratio |
|-----------|---------------------------|
| Preassigned | +0.02 (costs barely exceed speedup) |
| Decentralized | +1.17 (costs vastly exceed speedup) |

- Token costs scale strongly with team size in decentralized mode (ρ=0.40, p<0.001)
- Speedup does NOT scale with team size in decentralized mode (ρ=-0.07, p=0.15)
- **Worst case:** Decentralized serial, 5 agents → 6.24× tokens, 0.65× speedup = **9.6× cost per unit work**

---

## 5. THEORETICAL IMPLICATIONS

### The Architectural Tension (Central Theorem)
Every LLM team faces an inherited tradeoff:

| | Centralized | Decentralized |
|--|-------------|---------------|
| **Consistency** | ✅ Strong (single updater) | ❌ Weak (concurrent conflicts) |
| **Overhead** | ✅ O(n) communication | ❌ O(n²) communication |
| **Straggler resilience** | ❌ Vulnerable | ✅ Dynamic reallocation |
| **Fault tolerance** | ❌ Single point of failure | ✅ Redundancy |
| **Scalability** | Moderate | Worse (overhead grows faster) |

### The Cost Dominance Finding
Decentralized LLM teams consistently spend more on coordination than they gain in speedup. This is the **Brooks's Law** of LLM teams: "Adding agents to a late agent project makes it later."

### The Model Variance Discovery
Claude Sonnet 4.6 uniquely matched Amdahl predictions, while Gemini and GPT-5.2 fell significantly short. This suggests **model architecture affects coordination efficiency** — a factor not present in traditional distributed systems where nodes are homogeneous processors.

---

## 6. CROSS-REFERENCES TO PORTFOLIO

### Direct Validations
- **DD#390 (BIGMAS):** Uses centralized orchestrator + shared workspace — this paper explains why: avoids O(n²) overhead and consistency conflicts
- **DD#379 (Orla):** Workflow-level serving library with stage mapper = centralized coordinator — validated by Experiment 1's preassign superiority
- **DD#386 (Token Coherence):** MESI cache coherence protocol for agents addresses exactly the consistency violations observed here
- **CR#223 (Agent Serving Stack):** Infrastructure dominance thesis — this paper shows WHY: coordination overhead > compute overhead

### Extensions
- **DD#377 (REDEREF):** Probabilistic routing = hybrid centralized/decentralized — addresses straggler problem without full decentralization overhead
- **DD#378 (DOVA):** Deliberation-first orchestration = pre-filtering to reduce task count before parallelization
- **DD#374 (Negotiation):** LLM negotiation catastrophe (100× worse than heuristics) — this paper quantifies the coordination overhead that explains it
- **CR#170 (Compute Allocation):** Multi-level compute allocation — Amdahl's Law provides the theoretical ceiling for each level

### Novel Synthesis
- **CR#222 (Predictive Monitoring):** Geometric sensing can detect consistency violations before they propagate — the ORC curvature anomalies map to the concurrent-write/rewrite patterns identified here
- **DD#389 (Agentic Pressure):** Pressure-safety inversion may be amplified in teams — decentralized agents face additional coordination pressure

---

## 7. LAWS, MECHANISMS, PREDICTIONS

### Law 41: The Amdahl Ceiling Law
> LLM team speedup is bounded above by Amdahl's Law S = 1/((1-p) + p/s), and in practice falls significantly below this bound for most models.

### Law 42: The Coordination Cost Law (Brooks's Law for LLM Teams)
> In decentralized LLM teams, coordination overhead (tokens, idle rounds, consistency conflicts) grows faster than any speedup gains from parallelism. Median decentralized teams are SLOWER than single agents.

### Mechanism 43: The Consistency Violation Cascade
> Without centralized state management, concurrent agents produce three compounding violation types (concurrent writes → rewrites → dependency violations), each multiplying downstream test failures.

### Principle 86: Architecture-First Design
> Before optimizing prompts, tools, or models, determine the serial fraction of the task and select centralized vs. decentralized architecture accordingly. Task structure dominates all other design choices.

### Predictions
- **P-DS-1:** Hybrid architectures (centralized coordinator with limited agent autonomy) will outperform both pure centralized and pure decentralized designs on mixed-dependency tasks
- **P-DS-2:** As context windows grow, the "effective parallelizability" of tasks will increase, improving team scaling for currently mixed/serial tasks
- **P-DS-3:** Model-specific coordination efficiency will become a benchmark metric — some architectures inherently coordinate better than others (cf. Claude's Amdahl match)

---

## 8. CRITICAL ASSESSMENT

### Strengths
1. **Formal grounding** — not hand-waving analogy but structural correspondence with empirical validation
2. **Three frontier models** — results are model-general (with informative model-specific exceptions)
3. **Multiple metrics** — speedup, tokens, consistency violations, straggler gaps, test failures
4. **Code available** — github.com/emieczkowski/distributed-llm-teams

### Limitations
1. **Only coding tasks** — unclear if Amdahl scaling applies to creative, analytical, or adversarial tasks
2. **Homogeneous teams only** — real systems use heterogeneous models (different capabilities, costs)
3. **No memory/persistence** — agents don't build on prior sessions, limiting to single-round tasks
4. **Natural language ≠ packets** — the ambiguity of NL communication may create failure modes absent in traditional distributed systems
5. **Small scale** — max 5 agents. Real deployments may see different dynamics at 10-100 agents

### Missing Pieces
- No analysis of **fault tolerance** mechanisms (what happens when an agent hallucinates mid-task?)
- No exploration of **hybrid architectures** (the obvious next step)
- No connection to **CAP theorem** implications for LLM teams (consistency-availability-partition tolerance)

---

## 9. ACTIONABLE IMPLICATIONS FOR P82

1. **Our architecture is centralized** (dispatch → agents → report back) — this paper validates that choice for consistency-critical work
2. **But we're vulnerable to stragglers** — a slow Scout session blocks downstream processing
3. **Token overhead is real** — agent-to-agent communication (handoffs, cross-references) costs tokens that may exceed coordination value
4. **Task parallelizability analysis** should precede agent assignment — don't parallelize serial tasks
5. **The serial fraction of our research pipeline** (triage → deep-dive → synthesis → handoff) is high, limiting team scaling benefits

---

*This paper is the theoretical backbone our portfolio has been missing. Every prior finding about coordination overhead, infrastructure dominance, and scaling limits now has a formal framework to explain WHY.*
