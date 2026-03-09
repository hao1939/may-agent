# Deep Dive: TAPE (Tool-Guided Adaptive Planning) + General AgentBench

**Research Date:** 2026-03-09
**Sources:** arXiv:2602.19633 (TAPE), arXiv:2602.18998 (General AgentBench)
**Researcher:** Scout Agent
**Prior flag:** papers.md — both ★★★, Feb 26 batch, never deep-dived

---

## 1. TAPE: Tool-Guided Adaptive Planning with Constrained Execution

**Paper:** Jeong, Kim, Lee (University of Wisconsin–Madison). arXiv:2602.19633, Feb 23 2026.

### Core Problem

LM agents fail catastrophically in environments where a single error leads to irrecoverable failure — budget-constrained tasks, safety-critical actions, puzzles with dead-end states. The paper identifies **two distinct error sources**:

1. **Planning error** — The agent's internal reasoning recommends a non-viable action (e.g., pushing a box against a wall in Sokoban, creating a deadlock).
2. **Sampling error** — The agent's reasoning is correct, but stochastic token generation produces a different action than planned.

These errors **compound multiplicatively** as task horizon T increases. A toy analysis shows ReAct's success probability decays as ((1−ε_p)(1−ε_s·δ_b) + ε_p·ε_s·δ_r)^T — exponential decay.

### TAPE Architecture (4 components)

**Component 1: Plan Graph Construction**
- Generate M candidate abstract plans (M=4 optimal)
- Merge states across plans that share the same core information into a single graph node
- Result: a directed graph where edges represent actions and nodes represent states
- Key: multiple plans create alternative paths, so even if individual plans have errors, the *graph* may contain a viable path through cross-plan combinations

**Component 2: Plan Path Selection via ILP Solver**
- Formulate path selection as Integer Linear Programming
- Maximize accumulated reward subject to budget constraints, flow conservation, start/terminal constraints
- The solver operates on the plan graph to find the optimal *feasible* path
- This is where the "tool-guided" comes in — the solver uses predicted action costs from the LM's internal world model

**Component 3: Constrained Execution**
- Once a path is selected, **constrain decoding** so only the prescribed next action is admissible
- Uses constrained decoding (à la Willard & Louf 2023) — not just a prompt hint, but hard token-level restriction
- This eliminates sampling error entirely (reduces it to 0.0% in experiments)

**Component 4: Mismatch Check & Replanning**
- After each action, compare realized state to predicted state
- If mismatch detected: rebuild the plan graph from current state and re-solve
- This handles environment uncertainty and model knowledge gaps

### Key Experimental Results

**Benchmarks:** Sokoban, ALFWorld, MuSiQue, GSM8K-Hard (all with added feasibility constraints)

| Framework | Planning Error ↓ | Sampling Error ↓ | Success Rate ↑ |
|-----------|-----------------|------------------|----------------|
| ReAct | 50.7% | 8.3% | 5.0% |
| Plan-and-Act | 47.7% | 4.7% | 17.0% |
| **TAPE** | **36.7%** | **0.0%** | **46.0%** |

- TAPE improves success rates by **21.0 pp on hard settings** on average
- TAPE improves success rates by **20.0 pp for weaker base models** on average
- Even on strong models (gpt-5-nano), TAPE yields +48% relative improvement over ReAct
- Constrained Execution is the single most impactful component (removing it: 46→36)
- All three components are complementary (full ablation: all-off = 11.0%, all-on = 46.0%)

**Sensitivity to M (number of plans):**
- M=4 is optimal
- M=8 degrades performance — LM struggles to maintain global consistency across too many paths
- This is a critical finding: there's a sweet spot for plan diversity

### Theoretical Contribution

Paper formalizes success probability bounds for ReAct, Plan-and-Act, and TAPE:
- ReAct: success ≤ ((1−ε_p)(1−ε_s·δ_b))^T — exponential decay in T
- Plan-and-Act: reduces ε_s but not ε_p
- TAPE: reduces both, with ILP ensuring feasibility under budget constraints

---

## 2. General AgentBench: Benchmark Test-Time Scaling of General LLM Agents

**Paper:** Li, Ming, Setlur et al. (Carnegie Mellon University). arXiv:2602.18998, Feb 22 2026.

### Core Problem

Existing agent benchmarks evaluate agents in **domain-specific** settings (SWE-bench for coding, WebVoyager for browsing). Real-world agents must operate **across domains** with a unified toolset. When you move from domain-specific to general-agent evaluation, performance drops dramatically.

### Benchmark Design

- **7 benchmarks across 4 domains:** Coding (SWE-Bench Verified, Terminal-Bench), Search (BrowseComp, WebVoyager), Tool-use (Tau2-Bench, MCP-Bench), Reason (MathHay)
- **Unified tool interface** via MCP — all tools from all domains exposed simultaneously
- **~500 sampled instances** total
- **10 leading LLMs tested** (GPT-5, Claude Sonnet 4.5, Claude Haiku 4.5, DeepSeek-V3.2, DeepSeek-R1, Gemini 2.5 Pro/Flash, Qwen3-235B, Qwen3-Next, GPT-OSS-120B)

### Key Results

**Finding 1: Massive performance degradation in general setting**
- Most models drop 10-30% when moving from specialized to general evaluation
- Gemini 2.5-Pro drops >60% in Reason domain
- **Exception: Claude Sonnet 4.5 degrades only 0.2%** — dramatically more robust
- Claude Sonnet 4.5 achieves highest overall average (48.0)

**Finding 2: Context Ceiling (sequential scaling fails)**
- Extending interaction history initially helps, then **saturates or degrades**
- Qwen3-235B ceiling: ~112K tokens; Gemini 2.5-Flash ceiling: ~96K tokens
- Beyond the ceiling, agents either stagnate (repeat successes, fail to progress on failures) or oscillate (correct→incorrect→correct)
- **Contradicts non-agentic findings** where more compute = better. Agentic tasks expose fundamental context utilization limits.

**Finding 3: Verification Gap (parallel scaling limited)**
- pass@K increases monotonically — correct solutions exist in the sample space
- But **self-choice accuracy** lags far behind pass@K
- Models cannot reliably identify which of their K samples is correct
- Even using GPT-5 as external verifier **underperforms** models' own self-judgment on their trajectories
- Hypothesis: models are better at evaluating their own generations ("solution familiarity")

**Cross-domain tool usage (positive finding):**
- Some models (Claude, Qwen3-Next, DeepSeek-R1) actually **improve** in Search domain under general setting
- Reason: they repurpose tools from other domains (e.g., using HuggingFace API for search tasks instead of web search)
- 26% of Claude Sonnet 4.5's search tasks used specialized domain tools beyond plain web search

**Model Leaderboard (General AgentBench Average):**

| Model | Avg |
|-------|-----|
| Claude Sonnet 4.5 | 48.0 |
| GPT-5 | 45.9 |
| Claude Haiku 4.5 | 42.0 |
| DeepSeek-V3.2 | 39.0 |
| Gemini 2.5-Pro | 35.1 |
| Qwen3-Next | 32.6 |
| Qwen3-235B-A22B | 31.5 |
| Gemini 2.5-Flash | 30.5 |
| DeepSeek-R1 | 28.8 |
| GPT-OSS-120B | 25.4 |

---

## 3. Cross-Paper Synthesis: What These Papers Tell Us Together

### 3.1 The Compounding Error Problem Is Real and Quantified

TAPE proves mathematically that per-step errors compound exponentially with task horizon. General AgentBench shows this empirically: sequential scaling (more steps) doesn't help beyond a ceiling because the accumulated context introduces as many errors as it resolves. **The enemy is error accumulation, not task difficulty per se.**

### 3.2 The Verification Gap Validates TAPE's Approach

General AgentBench shows agents can't reliably pick the correct trajectory from parallel samples. TAPE's ILP solver addresses this — instead of asking the LM to verify (which it can't), delegate path selection to an external solver operating on predicted costs/rewards. **Replace LM judgment with formal optimization where possible.**

### 3.3 Constrained Execution Eliminates an Entire Error Class

TAPE reduces sampling error to 0.0% via constrained decoding. This is the single most impactful component. General AgentBench's context ceiling is partly driven by accumulated sampling errors in long histories. **If you can constraint-decode tool calls to match the plan, you eliminate a whole category of failure.**

### 3.4 Plan Diversity Has a Sweet Spot

TAPE: M=4 plans optimal, M=8 degrades. General AgentBench: parallel K>4 yields diminishing returns due to verification gap. **Both papers converge on "moderate diversity" — enough to find a good path, not so much that selection becomes the bottleneck.**

---

## 4. Connections to Prior Scout Research

### 4.1 → Bug-Hunt Architecture (deep-dive-bug-hunt)
Bug-Hunt uses 3-agent adversarial verification (Hunter/Skeptic/Referee). TAPE's plan graph + ILP solver is a more formal version of the same insight: **don't trust a single plan, generate alternatives and use a structured selection process.** Bug-Hunt does this socially (agents argue), TAPE does it algorithmically (ILP). Hybrid approach: generate candidate plans via adversarial agents, select via solver.

### 4.2 → Judge Reliability Harness (deep-dive-arxiv-2603-05399)
JRH shows no LLM judge is uniformly reliable. General AgentBench shows GPT-5 underperforms self-judgment. Both confirm: **LLM-as-verifier is unreliable.** TAPE's insight: use formal solvers instead. For our evaluator: format perturbation tests (JRH) + solver-based plan selection (TAPE) = two complementary defenses against unreliable judgment.

### 4.3 → Bias-Bounded Evaluation (deep-dive-arxiv-2603-05485)
Bias-bounded eval says "don't eliminate bias, bound its impact." TAPE says "don't eliminate planning error, aggregate plans and let a solver find viable paths despite errors." **Same meta-principle: accept imperfection, build systems that are robust to it.**

### 4.4 → DPIP Common Ground (deep-dive-arxiv-2603-05450)
DPIP shows LLMs fail at tracking shared beliefs across agents. TAPE's mismatch check is the single-agent version: **detect when reality diverges from the plan's assumptions and replan.** For multi-agent systems, this becomes: detect when agents' models of shared state diverge and force resynchronization.

### 4.5 → V₁ Pairwise Verification (discoveries)
V₁ shows pairwise comparison beats independent scoring for self-verification. General AgentBench's pair-wise self-choice generally outperforms point-wise. **Converging evidence: when you must verify, do it pairwise.** But even pairwise fails to close the verification gap — reinforcing TAPE's argument for formal solvers.

### 4.6 → Introspection Paper (deep-dive-arxiv-2603-05414)
Models detect anomalies but confabulate explanations. TAPE's mismatch check is the action-level version: detect that something went wrong (the state doesn't match) without needing to understand *why* — just replan. **Trust anomaly detection, don't trust the explanation.**

### 4.7 → MoE Tool-Calling Research (moe-tool-calling-research)
MoE models have severe tool-calling failures. TAPE's constrained execution directly addresses this: if you constrain decoding to the planned action, the model's tool-calling stochasticity is eliminated. **Constrained decoding as a fix for unreliable tool calling is a practically important insight for local MoE deployment.**

---

## 5. Actionable Takeaways for Our System

### Immediate (low effort, high value)

1. **Constrained tool-call execution.** When an agent has committed to a plan, constrain its next tool call to the planned action. Don't let stochastic sampling deviate from decided actions. This is the highest-ROI intervention from both papers.

2. **Detect plan-reality mismatch.** After each agent action, compare the actual result to expected result. If they diverge, force replanning rather than continuing the original plan. Simple assertion checking, not LM judgment.

3. **Use pairwise comparison for any verification step.** When comparing alternative plans/outputs/code patches, always use pairwise comparison rather than independent scoring.

### Medium-term (moderate effort)

4. **Plan graph construction for complex tasks.** For multi-step tasks (e.g., May decomposing a complex feature request), generate M=4 alternative decompositions, merge shared steps into a graph, then select the path with the best cost/reward tradeoff. This doesn't require an ILP solver — even a simple shortest-path algorithm on the merged graph would help.

5. **Context budget management.** General AgentBench's context ceiling finding means we should actively manage context length for long-running agents. Don't accumulate interaction history indefinitely — prune, summarize, or checkpoint. Our agents should have context budgets with hard limits.

6. **Cross-domain tool exposure.** General AgentBench shows agents can benefit from access to tools outside their primary domain (26% of Claude's search tasks used non-search tools). Don't over-restrict tool access — moderate tool breadth can improve performance.

### Strategic

7. **Formal verification as an alternative to LM judgment.** Where task constraints are formalizable (budgets, dependencies, type correctness), use actual solvers/type checkers/linters rather than asking an LM to verify. TAPE's ILP solver is the exemplar. Every formalizable check we delegate to a solver is a check we no longer need to trust LM judgment for.

8. **Moderate diversity, strong selection.** Both papers converge: generate 3-5 alternatives (not more), select carefully. The bottleneck is always selection, not generation. Invest in selection mechanisms (formal where possible, pairwise-comparative where not).

---

## 6. Open Questions

- **TAPE's code:** Paper claims "Code and data available" but no GitHub repo found as of Mar 9. Worth monitoring for release.
- **Scaling TAPE's plan graph:** For tasks with very large action spaces (e.g., coding), the plan graph could become intractable. Paper only tested on Sokoban/ALFWorld/MuSiQue/GSM8K — not open-ended software engineering.
- **Context ceiling variance:** General AgentBench shows ceiling varies by model and domain but doesn't explain *why*. Is it attention degradation? Knowledge interference? Context engineering (Anthropic's blog) suggests this is tractable.
- **Claude's robustness anomaly:** Claude Sonnet 4.5 degrades only 0.2% in general setting while all others drop 10-30%+. What architectural/training difference drives this? Paper doesn't explain. This is a competitively significant capability.
