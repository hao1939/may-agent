# Deep-Dive #290: AI Planning Framework for LLM-Based Web Agents

**Paper:** arXiv:2603.12710v1 (cs.AI, 13 Mar 2026)
**Authors:** Orit Shahnovsky, Rotem Dror (University of Haifa)
**Rating:** ★★★★☆ HIGH
**Date Reviewed:** 2026-03-16

---

## One-Sentence Summary

A formal taxonomy mapping modern LLM web agents to classical planning paradigms (Step-by-Step→BFS, Tree Search→Best-First, Full-Plan-in-Advance→DFS), with five novel process-quality metrics and 794 human-labeled gold trajectories on WebArena.

---

## Core Contribution

### The Planning Taxonomy

The paper treats web tasks as POMDPs with state space S, action space A, and formalizes three agent architecture types:

1. **Step-by-Step Agents → Breadth-First Search (BFS)**
   - Generate implicit candidate actions at each state, select one, observe outcome, repeat
   - Search horizon depth d=1 at each step
   - Prioritizes immediate state feedback over long-term planning
   - Examples: WebArena agent, Mind2Web

2. **Tree Search Agents → Best-First Tree Search**
   - Maintain explicit search tree T of explored states
   - Use value function V: S→[0,1] to score promisingness of branches
   - Iteratively expand most promising node s* = argmax V(s) over frontier
   - Example: Koh et al. (2024) search-augmented agent

3. **Full-Plan-in-Advance Agents → Depth-First Search (DFS)**
   - Generate complete planned trajectory τ = (a₁, a₂, ..., aₙ) before execution
   - Strictly traverse this pre-calculated branch
   - Plan serves as "external high-level memory" — resists context drift
   - **Novel contribution:** Authors implement the first pure Full-Plan-in-Advance web agent

### Five Novel Evaluation Metrics

The paper argues binary success/failure is inadequate. Their metrics:

| Metric | What It Measures | Formula Pattern |
|--------|-----------------|----------------|
| **Recovery Rate** | How well agent returns to human trajectory after deviation | recoveries / deviation incidents |
| **Repetitiveness Rate** | Proportion of non-redundant actions | 1 - (repetitive / total) |
| **Step Success Rate** | Proportion of human gold steps fulfilled | matched gold steps / total gold steps |
| **Partial Success Rate** | Multi-requirement task completion | completed requirements / total requirements |
| **Element Accuracy** | Alignment between planned and executed actions | matching planned-vs-actual / total steps |

### Key Innovation: LLM-as-a-Judge for Trajectory Comparison

Uses GPT-4o-mini as semantic judge to determine if two actions (human vs. agent) are semantically equivalent. Three-component prompt: task definition, evaluation criteria, chain-of-thought instructions. This enables nuanced trajectory comparison beyond string matching.

---

## Experimental Results

**Setup:** 812 WebArena tasks, GPT-4o-mini (temp=1.0, top-p=0.95), max 30 state transitions.

### Success Rates

| Domain | Step-by-Step | Full-Plan | Delta |
|--------|-------------|-----------|-------|
| CMS | 7.69% | 3.85% | -3.84% |
| GitLab | 12.33% | 10.96% | -1.37% |
| Map | 10.39% | 12.99% | +2.60% |
| Reddit | 4.00% | 8.00% | +4.00% |
| E-commerce | 5.00% | 2.51% | -2.49% |
| **All** | **38.41%** | **36.29%** | **-2.12%** |

**Key finding:** Full-Plan-in-Advance is competitive overall (-2.12%) and actually wins on structured, predictable domains (Reddit +4%, Map +2.6%).

### Process Quality Metrics

| Metric | Step-by-Step | Full-Plan |
|--------|-------------|-----------|
| Step Success Rate | 0.82 ± 0.14 | 0.58 ± 0.29 |
| Element Accuracy | 0.82 ± 0.12 | **0.89 ± 0.03** |
| Repetitiveness Rate | 0.79 ± 0.14 | 0.81 ± 0.13 |
| Recovery Rate | 0.36 ± 0.19 | 0.31 ± 0.12 |
| Partial Success Rate | 0.22 ± 0.39 | 0.12 ± 0.27 |

**Critical insight:** Full-Plan agent has **89% element accuracy** (vs 82% for Step-by-Step). This means when it makes a plan, it executes that plan faithfully. The bottleneck is plan quality, not execution fidelity.

### Failure Analysis

Full-Plan agent's lower step success rate (58% vs 82%) stems from:
- **LLM plans don't mirror human reasoning** — agents make assumptions about UI state that humans verify visually
- **Unnecessary actions** — agent plans explicit steps like "extract information" that humans do implicitly
- **Assumption mismatch** — plan assumes best/worst case scenarios instead of checking reality

---

## Dataset Contribution

**794 human-labeled gold trajectories** for WebArena:
- Manually completed 97.7% of 812 tasks (18 were unsolvable by design)
- Each step recorded as: action type + element name
- Open-sourced at [GitHub](https://github.com/shahnovsky/WebArena-Human-Trajectory-Dataset)
- First comprehensive reference trajectories for WebArena — enables process-quality evaluation

---

## Relevance to Our System

### ★★★★ HIGH — Direct Architectural Implications

**1. Taxonomy maps to our agent designs:**
- Our current agents (Scout, Bob, May) operate as **Step-by-Step** (BFS-style): each heartbeat cycle = one state → action → observe cycle
- The paper suggests hybrid approaches could be beneficial — **plan-ahead for structured tasks** (like Bob's file operations), **step-by-step for exploratory tasks** (like Scout's research)

**2. Process metrics for self-evaluation:**
- **Recovery Rate** — We could track how well agents recover from errors in SIGNALS.md / tool failures
- **Step Success Rate** — Compare agent execution traces against expected workflow
- **Element Accuracy** — Measure plan-execution gap: does the agent do what it said it would?
- **Repetitiveness Rate** — Flag agents stuck in loops (already partially implemented via our patrol checks)

**3. Context drift resistance:**
- Full-Plan agent embeds plan in every prompt as "external high-level memory" — directly analogous to our heartbeat.md approach
- Paper validates that plan-in-prompt reduces context drift, confirming our heartbeat architecture is sound
- Suggests **plan quality** is the bottleneck, not drift resistance

**4. LLM-as-Judge for trajectory evaluation:**
- Could be applied to evaluate our agents' journal entries and todo completion quality
- Semantic matching between planned and actual actions → measure agent reliability

### Connection to Prior Deep-Dives

- **DD#273 (ToolTree):** Both papers use tree search for agent planning, but ToolTree focuses on tool selection while this focuses on web navigation. ToolTree's MCTS with dual-stage evaluation corresponds to this paper's "Tree Search" category.
- **DD#274 (BAVT):** Budget-aware value trees also implement best-first search with resource constraints. This taxonomy would classify BAVT as a "Tree Search" agent with budget-aware heuristics.
- **DD#277 (CMAG):** Constitutional governance operates at meta-level above individual agent planning strategies. CMAG's hard constraints = planning constraints, soft optimization = heuristic search.
- **DD#280 (Semantic Invariance):** Tests agent robustness to input perturbations — directly relevant here since Full-Plan agents show lower variance (±0.03 element accuracy vs ±0.12) suggesting more robust execution once plans are locked in.

---

## Limitations

1. **Only two architectures compared** — no Tree Search agent implemented/tested
2. **GPT-4o-mini only** — no comparison across model sizes/families
3. **Temperature 1.0** is unusually high for web agents, may artificially inflate variance
4. **Success rates modest** (36-38%) — both agents underperform SOTA web agents
5. **LLM-as-Judge reliability** — no inter-annotator agreement reported for semantic matching
6. **No replanning mechanism** — Full-Plan agent can't recover from plan failures (acknowledged by authors)

---

## Actionable Insights

1. **Hybrid planning for our system:** Use Full-Plan for structured, predictable tasks (file operations, known workflows) and Step-by-Step for exploratory/uncertain tasks (research, debugging)
2. **Add process metrics:** Implement Recovery Rate and Repetitiveness Rate tracking for agent session logs
3. **Plan-in-prompt validated:** Our heartbeat.md serving as "persistent plan" is architecturally sound — confirmed by this paper's findings on context drift resistance
4. **Element Accuracy as self-check:** Agents could compare "what I planned to do" vs "what I actually did" at session end for reliability tracking

---

## Rating Justification: ★★★★☆ HIGH

Strong conceptual contribution connecting modern LLM agents to classical planning theory. The taxonomy is clean and useful. The five metrics fill a real gap in agent evaluation. The 794-trajectory dataset is a valuable community resource. Limited by testing only two architectures with a modest-capability model, but the framework itself is broadly applicable. Directly relevant to our multi-agent system architecture and evaluation practices.
