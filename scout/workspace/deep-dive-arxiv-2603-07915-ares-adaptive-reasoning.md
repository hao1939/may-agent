# Deep Dive: Ares — Adaptive Reasoning Effort Selection for Efficient LLM Agents

**Paper:** arXiv:2603.07915v1 (Mar 9, 2026)
**Authors:** Jingbo Yang, Bairu Hou, Wei Wei, Yujia Bao, Shiyu Chang
**Venue:** ICML 2026

## Core Idea

Modern thinking LLMs (GPT-5, Gemini-3) support configurable reasoning levels (high/medium/low), but using a fixed level for all steps is suboptimal: always-high is expensive, always-low degrades performance ~20%. Ares introduces a **lightweight router model (Qwen3-1.7B)** that predicts the **minimum sufficient reasoning effort** for each step in a multi-step agent task.

Key innovation: **intra-model reasoning level routing** (not inter-model routing). Same model, different thinking effort → consistent KV cache reuse, well-defined cost-performance frontier, no redundant context encoding.

## Architecture

```
Per step t:
  1. Router (Qwen3-1.7B) receives: task x, history h_t, observation o_t
  2. Router predicts: effort level e_t ∈ {low, mid, high}
     (with reasoning rationale before the label)
  3. Agent LLM (gpt-oss-20b) executes step at effort e_t
  4. Action a_t is produced
```

**Optimization objective:** max θ E[V(τ,x) − λ Σ cost(e_t)]
- V(τ,x) = task success (binary)
- cost(e_t) = total tokens generated at step t (reasoning + action)

## Training Pipeline (3 Phases + RL)

### Phase 1: Trajectory Collection
- Collect high-quality successful trajectories using the backbone LLM at high reasoning
- Sources: APIGen-MT (tool use), rejection sampling (BrowseComp), AgentOccam (WebArena)

### Phase 2: Reasoning Effort Annotation
- For each step in a successful trajectory, test: can the agent reproduce the correct action at lower effort?
- Binary search down: try low → if correct stably, label "low"; else try medium → if correct, "medium"; else "high"
- Decomposition trick: multi-step effort labeling → independent single-step classification

### Phase 3: Rationale Generation
- Use a teacher LLM to generate a brief reasoning rationale for why each effort level was chosen
- "Analyze the environment → predict effort" rather than direct classification
- This is critical: ablation shows removing rationale drops accuracy from 54.8% → 51.3%

### Phase 4: Reinforcement Learning (GRPO)
- Router rollout: run the full task with router predictions, observe outcomes
- Reward = task success + normalized cost penalty
- Key finding: **normalized cost reward >> unnormalized** (15% fewer tokens, higher accuracy)
- RL Data Filtering: only train on trajectories that differ from SFT predictions

## Experimental Results

### Backbone: gpt-oss-20b (all benchmarks)

**TAU-Bench Retail (tool use):**
| Method | Acc (%) | T_total |
|--------|---------|---------|
| Low | 35.0 | 25k |
| Medium | 47.3 | 137k |
| High | 54.8 | 1007k |
| Random | 43.5 | 359k |
| GPT-5 router | 40.0 | 132k |
| Gemini-3 Pro router | 46.1 | 128k |
| **Ares (SFT)** | **54.8** | **652k** (-35.2%) |
| **Ares (RL)** | **58.5** | **476k** (-52.7%) |

**TAU-Bench Airline (counter-intuitive domain):**
- High effort actually WORSE than Medium (38.0% vs 42.0%) — "overthinking"
- Ares RL matches Medium at 42.0% with only 133k tokens (vs 873k for High)
- RL specifically learns to suppress high-effort, boosting low to ~70%

**BrowseComp-Plus (deep research):**
| Method | Acc (%) | T_total |
|--------|---------|---------|
| Low | 8.0 | 5k |
| High | 42.7 | 1841k |
| **Ares (SFT)** | **41.3** | **1071k** (-41.8%) |

**WebArena (web navigation):**
| Method | Acc (%) | T_total |
|--------|---------|---------|
| Low | 37.4 | 67k |
| High | 45.0 | 2763k |
| **Ares (SFT)** | **46.5** | **1512k** (-45.3%) |

WebArena is the only benchmark where Ares BEATS the always-high baseline (46.5% vs 45.0%). Excessive reasoning → "overthinking" → incorrect action formats, loss of task focus.

### Cross-Scale Generalization (gpt-oss-120b backbone)
Router trained on gpt-oss-20b, evaluated on gpt-oss-120b (6× larger):
| Method | Acc (%) | T_total |
|--------|---------|---------|
| High | 67.8 | 558k |
| **Ares** | **65.2** | **428k** (-23%) |

Router transfers across model scales! The effort-selection cues are scale-invariant.

### Step-Level Routing Analysis
- **Early steps** (0-2): predominantly LOW effort — initial navigation is simple
- **Later steps**: HIGH effort increases as task complexity grows
- **Action categories**: simple actions (click URL) → low; complex actions (fill forms, multi-step navigation) → high

### Ablation Results (TAU-Bench Retail)
| Setting | Acc (%) | T_total |
|---------|---------|---------|
| No SFT (base Qwen3-1.7B) | 41.7 | 128k |
| No Rationale | 51.3 | 474k |
| **Ares (SFT)** | **54.8** | **652k** |

- Without SFT: base model defaults to always-low → biggest accuracy drop
- Without rationale: router still works but less precisely → 3.5% accuracy loss
- Rationale generation is cheap (tiny model) but high-value

## Key Insights

### 1. Overthinking Is Real
- On TAU-Bench Airline, high effort (38%) < medium effort (42%)
- On WebArena, Ares (46.5%) > always-high (45.0%)
- "Excessive reasoning can lead to divergent processes, resulting in incorrect action formats or loss of task focus"
- This is the first empirical quantification of overthinking in agent settings

### 2. Error Propagation Makes Multi-Step Routing Harder Than Single-Step
- In single-turn tasks (math, coding), you can independently classify difficulty
- In multi-step tasks, a reasoning deficit at step t propagates to steps t+1...T
- Ares solves this by conditioning on the full interaction history, not just the current observation
- **Direct connection to our error cascade research (2603.04474)**: reasoning deficits are a form of error injection

### 3. Lightweight Routers Outperform LLM Routers
- GPT-5 and Gemini-3 Pro as routers: worse accuracy AND similar/higher cost
- Qwen3-1.7B fine-tuned router: best accuracy, lowest overhead
- **Prompting-based routing is unreliable** — trained routers dominate

### 4. RL Corrects SFT Bias
- SFT router tends to over-allocate high effort (learned from high-effort trajectories)
- GRPO specifically learns to compress unnecessary high-effort steps
- On Airline: RL drops high-effort usage from 50% to <20%, boosting accuracy by 6%

### 5. Scale-Invariant Transfer
- Router trained on 20B model works on 120B model with -23% token reduction
- "Reasoning rationales and effort-selection cues are scale-invariant"
- Practical implication: train router once on cheap model, deploy on expensive model

## Connections to Our Research Archive

### → Error Cascades (2603.04474)
Ares implicitly models error propagation: the router learns that early-step reasoning deficits cascade, so it allocates more effort to early critical steps. The interaction history conditioning allows the router to detect when previous steps may have been under-reasoned.

### → Adversarial Topology (Bug-Hunt, 2603.06856)
Ares shows that "more reasoning ≠ better" — same principle as adversarial topology degrading to 27.3%. Overthinking in agents parallels "artificial doubt" in adversarial setups.

### → Dynamic Model Routing Survey (2603.04445)
Ares validates the survey's core claim that intelligent routing is essential, but goes beyond inter-model routing to intra-model effort routing — a strictly better-defined optimization problem.

### → Art of Efficient Reasoning (2602.20945)
Ares is the agent-level application of efficient reasoning principles. While 2602.20945 focused on single-turn reasoning efficiency, Ares extends to multi-turn sequential decision-making.

### → C3 Credit Assignment (2603.06859)
Both papers address "which steps matter?" C3 asks which agent messages matter for outcomes; Ares asks which steps need deep reasoning. The credit assignment lens could improve Ares: steps with high counterfactual impact should get high effort.

## Applicability to Our System

### Direct Applications

1. **May/Coder/QA effort routing**: Implement a lightweight reasoning effort router for our pipeline. May's delegation step = high effort; simple file reads = low effort; complex code generation = high effort; routine test execution = low effort. This could cut our token costs ~40-50% with minimal quality loss.

2. **Evaluator effort calibration**: Our evaluator doesn't need deep reasoning for obviously-passing or obviously-failing submissions. Route effort based on the code diff complexity and test results.

3. **Adaptive system prompts**: Instead of a fixed system prompt complexity, dynamically include/exclude context based on step difficulty assessment.

### Design Principles Extracted

- **Principle 1 — Minimum Sufficient Reasoning**: Always ask "what's the minimum reasoning level that reliably produces the correct action?" Don't default to max.
- **Principle 2 — History-Conditioned Routing**: Effort decisions should depend on what happened so far, not just the current observation.
- **Principle 3 — Overthinking Penalty**: Explicitly model the cost of over-reasoning; more thinking can cause divergence and format errors.
- **Principle 4 — Rationale Before Decision**: Even tiny models benefit from "thinking before deciding" — always generate a brief analysis before the classification label.
- **Principle 5 — Train Small, Deploy Big**: Effort patterns transfer across model scales.

## Limitations & Gaps

1. **Single backbone tested**: Only gpt-oss-20b (and generalization to gpt-oss-120b). Unknown if patterns hold for Claude, open-source models.
2. **Fixed effort levels**: Assumes discrete {low, mid, high}. Continuous budget allocation (e.g., max token limits) not explored.
3. **No multi-agent routing**: Each agent is routed independently. In our multi-agent system, cross-agent reasoning dependencies might change optimal effort allocation.
4. **No online adaptation**: Router is frozen at inference time. Could it adapt to task difficulty distributions in real-time?
5. **Cost metric is token count**: Doesn't account for latency, which may matter more in interactive settings.

## Bottom Line

Ares is the most practically useful paper for cost optimization in agentic systems I've encountered. The 52.7% token reduction with maintained accuracy is a compelling result. The finding that overthinking actively hurts performance on some tasks (Airline, WebArena) challenges the "more thinking = better" assumption. The cross-scale transfer result means we could prototype routing cheaply.

**Priority: HIGH** — This directly informs how we structure our agent invocations.
