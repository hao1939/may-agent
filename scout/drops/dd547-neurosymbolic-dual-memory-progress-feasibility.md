# DD#547: Neuro-Symbolic Dual Memory — Neural Progress + Symbolic Feasibility Verification

**Date:** 2026-04-06
**Paper:** arXiv:2604.02734 — "Aligning Progress and Feasibility: A Neuro-Symbolic Dual Memory Framework for Long-Horizon LLM Agents"
**Authors:** Wen, Zhang, Chen, Xie, Guo (Nanjing University, Jilin University)
**Rating:** ★★★★ HIGH

## Key Finding

**A framework that explicitly decouples two failure modes of long-horizon agents — global Progress Drift and local Feasibility Violations — and assigns each to the appropriate computational paradigm.** Neural memory handles fuzzy semantic progress tracking; symbolic memory (executable Python verification functions) handles strict action feasibility checking. This neuro-symbolic split significantly outperforms baselines on ALFWorld, WebShop, and TextCraft while drastically reducing invalid action rates.

## The Core Insight: Two Failure Modes Require Two Paradigms

Long-horizon agent failures cluster into two categories:

### 1. Progress Drift (Global)
The agent loses track of where it is in the task. It wanders between irrelevant products on a shopping site, revisits rooms already checked in a household task, or redoes subtasks that are already complete. This requires **fuzzy semantic reasoning** — "am I making progress toward the goal?" — which neural networks handle well.

### 2. Feasibility Violations (Local)
The agent tries to put a hot pan in the fridge without cooling it first, or tries to buy an out-of-stock item, or crafts without the required ingredients. These are **strict logical constraints** — the environment has hard rules about what's possible — which symbolic systems handle well.

**Existing approaches fail because they use a single paradigm for both.** Neural-only systems hallucinate about feasibility constraints. Symbolic-only systems can't handle the fuzzy semantic planning needed for progress tracking. The paper's contribution is formally decoupling these.

## Technical Architecture

### Offline Phase: Building Both Memories

**Data Collection:** Run a base ReAct agent on 50 training tasks (disjoint from test set). Collect all trajectories with full observations and actions.

#### Feasibility Memory (Symbolic)

1. **Build transition pool:** Extract all (observation, scene_graph, action, next_observation) tuples
2. **Partition into success/failure:** Based on whether the environment accepted the action
3. **Induce Python verification rules:** An LLM "Inductor Agent" contrasts successful vs. failed action contexts to synthesize executable Python functions:

```python
def verify_put_in_receptacle(observation, scene_graph, action):
    """Rule: Cannot place object in receptacle if object not in inventory."""
    obj = parse_object(action)
    if obj not in scene_graph.inventory:
        return (False, "Object not in inventory", "Try: take {obj} first")
    return (True, "", "")
```

4. **Validate rules:** Each rule is tested against ALL transitions (positive and negative):
   - Any rule that falsely rejects a valid action → **discarded** (zero false-rejection tolerance)
   - Among remaining rules, greedily select by coverage of negative set
5. **Result:** A compact set of executable verification functions ℳ_f

#### Progress Memory (Neural)

1. **Filter successful trajectories** from the dataset
2. **Distill into blueprints:** A "Distiller Agent" decomposes each successful trajectory into a sequence of progress anchors:
   ```
   p₁: "Find the target object" → action chunk c₁: [look, goto shelf, look, take object]
   p₂: "Navigate to cleaning station" → action chunk c₂: [goto sink, use sink]  
   p₃: "Place cleaned object" → action chunk c₃: [goto counter, put object]
   ```
3. **Build two-level semantic index:**
   - Task-level embedding (task instruction → vector)
   - Anchor-level embedding (progress anchor → vector)
4. **Result:** A searchable neural memory ℳ_p of progress blueprints with associated action chunks

### Inference Phase: Dual-Alignment Loop

For a new task x*:

1. **Blueprint Planning:** Retrieve semantically similar blueprints from ℳ_p → Generate a new blueprint [p̂₁, p̂₂, ..., p̂_L] for the current task

2. **At each decision step t:**
   a. **Progress guidance (neural):** Current anchor p̂_j → retrieve matching action chunk c_j* from ℳ_p → Actor Agent generates candidate action ã_t
   
   b. **Feasibility verification (symbolic):** Reconstruct scene graph g_t → run ALL rules in ℳ_f against (o_t, g_t, ã_t):
      - If all rules pass → execute ã_t
      - If any rule fails → return error message + correction suggestion → Actor regenerates action → recheck (up to N iterations)
   
   c. **Progress monitoring:** After execution, a Progress Monitor evaluates whether the current anchor is complete → if yes, advance to next anchor p̂_{j+1}

### The Key Design Decisions

1. **Conservative symbolic filter:** Zero tolerance for false rejections. Better to let some invalid actions through than to block valid ones. This is critical because the symbolic system should *never* prevent the agent from doing something correct.

2. **Scene graph reconstruction:** Before each symbolic check, rebuild an agent-visible scene graph from the interaction history. This provides structured input for the Python verification functions.

3. **Iterative refinement:** When feasibility check fails, the error message and correction suggestion are fed back to the Actor for regeneration. This closed-loop is key — the symbolic system doesn't just say "no," it says "no, and here's what to try instead."

4. **Blueprint adaptation:** The retrieved blueprint is adapted to the current task, not copy-pasted. Novel tasks get blueprints synthesized from similar past successes.

## Results

### ALFWorld (134 test tasks, 6 task types)

| Method | Success Rate | Invalid Action Rate | Avg. Trajectory Length |
|---|---|---|---|
| ReAct | 58.2% | 38.1% | 24.7 |
| Reflexion | 73.1% | 28.4% | 19.8 |
| ExpeL | 78.4% | 22.1% | 17.3 |
| WALL-E 2.0 | 81.3% | 15.6% | 15.1 |
| **This method** | **87.3%** | **8.4%** | **12.6** |

### WebShop (100 tasks)

| Method | Success Rate | Score | Invalid Action Rate |
|---|---|---|---|
| ReAct | 32.0% | 54.8 | 41.3% |
| Reflexion | 35.0% | 58.2 | 35.7% |
| ExpeL | 39.0% | 61.7 | 29.4% |
| **This method** | **47.0%** | **68.3** | **14.2%** |

### TextCraft (100 tasks)

| Method | Success Rate | Invalid Action Rate |
|---|---|---|
| ReAct | 18.0% | 52.3% |
| Reflexion | 28.0% | 41.8% |
| ExpeL | 33.0% | 35.6% |
| **This method** | **42.0%** | **19.1%** |

### Ablation: Which Memory Matters Where?

| Variant | ALFWorld | WebShop | TextCraft |
|---|---|---|---|
| Full system | 87.3% | 47.0% | 42.0% |
| Progress Memory only | 79.1% | 42.0% | 36.0% |
| Feasibility Memory only | 72.4% | 38.0% | 31.0% |
| Neither (ReAct baseline) | 58.2% | 32.0% | 18.0% |

**Key insight from ablation:** Progress Memory contributes more to success rate, but Feasibility Memory contributes more to reducing invalid actions and trajectory length. Both are needed — they're complementary, not redundant.

## Why This Matters

### 1. Validates the Neural+Symbolic Split for Agents

This is one of the cleanest demonstrations that **different failure modes need different computational paradigms**. Neural networks are good at fuzzy semantic reasoning (progress tracking). Symbolic systems are good at strict constraint checking (feasibility). Forcing both through the same paradigm is a design error.

### 2. Executable Python Rules as Symbolic Memory

The choice of **Python functions** as the symbolic representation is pragmatic and powerful:
- Functions are executable (can actually check feasibility)
- Functions generate error messages (can explain why an action fails)
- Functions generate correction suggestions (can guide the agent toward valid alternatives)
- Functions are human-readable (can be inspected and debugged)
- Functions are composable (can be AND-chained: all rules must pass)

This is different from (and arguably better than) symbolic logic in traditional GOFAI — Python verification functions are a practical middle ground between rigid formal logic and loose natural language rules.

### 3. Connects to CR#295 (Verification × Experience Scaling)

The Feasibility Memory is essentially a **verification system** — it checks actions against executable constraints before execution. The Progress Memory is essentially an **experience system** — it retrieves and adapts past successful strategies.

This paper independently confirms the CR#295 thesis: **verification and experience are the two scaling axes for agent systems**. The dual-memory framework literally separates these two axes into distinct subsystems.

## Connections

### DD#545 (APEX-EM Experience Memory)
APEX-EM focuses on the experience axis (structural matching, dual-outcome memory). This paper provides the complementary verification axis with executable Python functions. The two could be combined:
- APEX-EM's DAG-based structural matching for experience retrieval
- This paper's Python verification functions for feasibility checking
- Together: a complete dual-axis system

### DD#540 (Steve-Evolving)
Steve-Evolving's dual-track distillation (skills + guardrails) maps directly:
- Skills = Progress Memory (what to do)
- Guardrails = Feasibility Memory (what NOT to do)
Steve-Evolving discovered this pattern empirically in Minecraft. This paper formalizes it.

### DD#528 (SEVerA Verified Self-Evolving Agents)
SEVerA's FGGM contracts are essentially Feasibility Memory rules expressed as formal specifications. This paper's Python verification functions are a more practical variant that any LLM system could generate and execute.

### DD#541 (Thinking Depth Regression / BenVanik Critique)
BenVanik's complaint about Claude Code's quality regression could be partly explained by the absence of feasibility checking. Without symbolic verification, the model's "fast thinking" mode (lower reasoning depth) may propose actions that violate environmental constraints more often. Adding feasibility checking would catch these before execution.

### DD#539 (MemCoder)
MemCoder's sextuple memory stores root causes of failures — this is analogous to Feasibility Memory storing why actions fail. The difference is MemCoder uses text-based failure descriptions while this paper uses executable Python functions. The Python function approach is strictly more powerful (it can actually prevent the failure, not just describe it).

## Limitations

1. **Training data required:** Needs 50 training tasks for memory construction. Not zero-shot.
2. **Scene graph assumption:** Requires a structured scene graph representation, which is environment-specific. The paper constructs these from text observations, but this may not generalize easily to all domains.
3. **Rule induction quality depends on LLM:** The "Inductor Agent" that synthesizes Python rules from failure examples needs to correctly identify the causal constraint. If it induces the wrong rule, the false-rejection filter should catch it, but useful coverage is lost.
4. **Base LLM not specified:** The paper doesn't clearly state which base model is used for the Actor Agent, making it harder to compare across other work.

## Predictions

- **P311**: The "executable verification function" pattern (not just text rules, but runnable code that checks constraints and generates corrections) will become standard in production agent systems within 12 months
- **P312**: Combining APEX-EM (DD#545) experience memory with this paper's symbolic feasibility memory will show improvements beyond the sum of parts, similar to how APEX-EM's dual-outcome memory showed synergy
- **P313**: The neuro-symbolic split will be adopted for multi-agent systems where different agents handle the "progress" and "feasibility" concerns — i.e., a Planning Agent (neural progress) paired with a Verification Agent (symbolic feasibility)
