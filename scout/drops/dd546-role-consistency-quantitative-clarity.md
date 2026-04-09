# DD#546: Quantitative Role Clarity — Reducing Agent Role Overstepping from 46.4% to 8.4%

**Date:** 2026-04-06
**Paper:** arXiv:2604.02770 — "Improving Role Consistency in Multi-Agent Collaboration via Quantitative Role Clarity"
**Authors:** Zhou, Han, Yang, Wang, Zhou, Fu (Northeast Normal University, Guangxi Normal University)
**Rating:** ★★★★ HIGH

## Key Finding

**A differentiable "role clarity" metric that measures and corrects agent role overstepping in multi-agent systems.** The authors define a role assignment matrix S(ϕ) where s_ij measures semantic similarity between agent i's *behavior trajectory* and agent j's *role description*. They then define a role clarity matrix M(ϕ) = softmax(S(ϕ)) - I, whose Frobenius norm quantifies total role deviation. Using this as a LoRA fine-tuning regularizer, they reduce role overstepping from 46.4% → 8.4% (Qwen) and 43.4% → 0.2% (Llama), while improving end-to-end task success.

## The Problem: Role Overstepping

In multi-agent systems like ChatDev, agents are assigned roles (CEO, CTO, Programmer, Tester) via natural language prompts. Empirical finding: **agents routinely violate their role boundaries**, with the overstepping rate reaching 43-46% across mainstream models.

Role overstepping means:
- The CEO starts writing code (programmer's job)
- The tester makes product decisions (CEO's job)  
- The programmer reviews their own code (reviewer's job)

This isn't just a cosmetic issue — it directly reduces task success rates because agents duplicate work, miss their assigned subtasks, and create coordination chaos.

### Baseline Overstepping Rates (ChatDev on SWE-Dev)

| Model | Temperature=0.0 | Temperature=0.7 | Temperature=1.0 |
|---|---|---|---|
| DeepSeek Chat | 36.2% | 38.7% | 41.3% |
| Qwen 2.5 7B | 42.1% | 44.8% | 46.4% |
| Llama 3.1 8B | 39.6% | 42.1% | 43.4% |

**Nearly half of all agent interactions violate role boundaries.** This is a systemic issue, not an edge case.

## Technical Approach

### Step 1: Role Assignment Matrix

Given n agents, each with role description R_i and behavior trajectory B_i, embed both into a shared semantic space using the LLM's own hidden states (mean-pooled final layer):

```
r_i = MeanPool(h_{R_i})     # role embedding  
b_i = MeanPool(h_{B_i})     # behavior embedding
s_ij = cos(b_i, r_j)        # similarity: agent i's behavior vs. agent j's role
```

The n×n matrix S(ϕ) captures all agent-role alignment pairs simultaneously.

### Step 2: Role Clarity Matrix

Apply row-wise softmax to S(ϕ) and subtract the identity matrix:

```
M(ϕ) = softmax_τ(S(ϕ)) - I
```

**Interpretation:**
- When M(ϕ) = 0, each agent's behavior aligns perfectly with its own role (softmax diagonal = 1)
- Diagonal terms of M(ϕ) capture *role inconsistency* (agent deviating from own role)
- Off-diagonal terms capture *role overstepping* (agent behaving like another agent's role)
- ||M(ϕ)||_F provides a single scalar measuring total system role confusion

### Step 3: Differentiable Regularizer

The key innovation: M(ϕ) is differentiable through the LLM parameters, enabling gradient-based optimization:

```
L_total = L_MLE + λ · L_RC
L_RC = -(1/n) Σ_i log softmax_τ(s_ii)  # cross-entropy of correct assignments
```

This is added as a regularizer during LoRA fine-tuning. The MLE loss teaches the model to generate correct outputs; the role clarity loss teaches it to stay within role boundaries.

### Step 4: Training Data via Rejection Sampling

To get clean training data, they apply rejection sampling:
1. Run multi-agent interactions
2. Filter for episodes where agents terminate properly with `<INFO>` token (= no overstepping)
3. Use these clean trajectories as LoRA training data

## Results

### Role Consistency Improvements

| Model | Overstepping (Before) | Overstepping (After) | Role Clarity Score (Before) | Role Clarity Score (After) |
|---|---|---|---|---|
| Qwen 2.5 7B | 46.4% | **8.4%** | 0.5328 | **0.9097** |
| Llama 3.1 8B | 43.4% | **0.2%** | 0.5007 | **0.8530** |

### End-to-End Task Performance

| Model | Task Success (Before) | Task Success (After) |
|---|---|---|
| Qwen 2.5 7B | 0.6769 | **0.6909** (+2.1%) |
| Llama 3.1 8B | 0.6174 | **0.6763** (+9.5%) |

The end-to-end improvement is modest but consistent. The role clarity improvement is dramatic. The disconnect suggests role consistency is necessary but not sufficient for task success — you also need the right task decomposition and individual agent competence.

## Why This Matters

### 1. First Quantitative Definition of Role Clarity

Previous approaches to role consistency in MAS are:
- **Prompt-based**: "You are the CEO. Do NOT write code." → Degrades over long contexts
- **Rule-based**: Hard-coded action filters → Brittle, doesn't generalize
- **Evaluation-only**: Post-hoc assessment → Doesn't prevent overstepping

This paper provides the first **quantifiable, differentiable, optimizable** definition. The role clarity matrix M(ϕ) can:
- Measure role confusion at any point during execution
- Identify which specific agents are overstepping and into which roles
- Be used as a training signal for gradient-based correction

### 2. LoRA Makes It Practical

The regularizer works with LoRA (low-rank adaptation), meaning:
- No full model retraining needed
- Lightweight fine-tuning (<1% of parameters modified)
- Can be applied to any base model
- Role clarity is "baked into" the model rather than enforced externally

### 3. The 46% Overstepping Rate Is a Wake-Up Call

Nearly half of all multi-agent interactions involve role violations. This suggests most production MAS are operating with massive role confusion that's going unmeasured. If you're running a multi-agent system and haven't checked for role overstepping, you probably have this problem.

## Connections

### DD#534 (Intellectual Elites / Power Laws in MAS)
DD#534 showed that information flow in MAS follows power laws with a few "intellectual elites" dominating. Role overstepping is likely a mechanism for this — when the CEO agent starts writing code, it's centralizing power. Role clarity regularization could help distribute actual work more evenly.

### DD#535 (Sycophancy Propagation)
Sycophancy in MAS means agents agree with each other rather than doing their jobs. Role overstepping is the complementary failure: agents do each other's jobs rather than their own. The role clarity matrix could detect sycophancy too — if agent i's behavior looks identical to agent j's behavior (rather than agent j's role), that's a sycophancy signal.

### CR#290 (MAS Scaling Paradox)
Role overstepping directly contributes to the scaling paradox. Adding agents should add capabilities, but if 46% of interactions involve role violations, adding agents just adds noise. Role clarity regularization could be a prerequisite for effective MAS scaling.

### DD#544 (Automatic Textbook Formalization)
The formalization paper's 7-role decomposition (sketcher, prover, reviewer×2, maintainer, triage, scan, progress) works because each role has a **formally different interface** — the sketcher outputs Lean skeletons, the prover outputs proofs, the reviewer checks proofs. The role boundaries are enforced by the type system, not by prompts. This paper's approach would help in softer domains where type-based enforcement isn't possible.

## Limitations

1. **Tested only on ChatDev** — A single benchmark (software development). Would be valuable to see this on other MAS domains (debate, scientific discovery, customer service)
2. **Requires clean training data** — The rejection sampling approach needs successful role-consistent episodes to exist. Cold-start problem if the base model is very bad at roles.
3. **Task success improvement is modest** — Dramatic role clarity gains (46% → 8%) only translate to modest task success gains (+2-9%). Suggests other bottlenecks dominate once role confusion is resolved.
4. **Small models only** — Tested on 7-8B parameter models. Larger models may already have better inherent role consistency.

## Predictions

- **P308**: Role overstepping rates above 30% will be found in most production multi-agent systems that haven't specifically optimized for role consistency
- **P309**: Combining role clarity regularization with verification-based architectures (CR#295) will show multiplicative improvements — role clarity prevents agents from stepping on each other's toes, verification prevents them from producing wrong outputs
- **P310**: The role clarity matrix will be extended to dynamic role assignment — using M(ϕ) to detect when an agent is better suited to a different role and reassigning mid-task
