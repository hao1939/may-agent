# Deep-Dive #365: MOSAIC — Learning When to Act or Refuse: Guarding Agentic Reasoning Models for Safe Multi-Step Tool Use

**Source:** arXiv:2603.03205 (March 2026, 24 pages, 5 figures)
**Authors:** Aradhye Agarwal, Gurdit Siyan, Yash Pandya, Joykirat Singh, Akshay Nambi, Ahmed Awadallah — Microsoft Research
**Rating:** ★★★★★ CRITICAL

---

## 1. Core Problem

Agentic language models operate in a **fundamentally different safety regime** than chat models. They plan, call tools, and execute long-horizon actions where a single misstep (accessing files, entering credentials) can cause **irreversible harm**. Existing alignment methods, optimized for static generation and task completion, break down due to:

- **Sequential decision-making**: harmful intent distributed across multiple individually-plausible steps
- **Adversarial tool feedback**: prompt injection via tool responses
- **Overconfident intermediate reasoning**: long reasoning traces omit explicit safety checks
- **Scalar reward collapse**: outcome-only rewards miss trajectory-level safety distinctions (early refusal vs. late abort)

**Critical insight**: Models that refuse unsafe chat prompts often comply once the task is reframed as tool use (Hakim et al., 2026; Li et al., 2025). Safety ≠ chat safety in agentic settings.

## 2. MOSAIC Framework

**Plan → Check → Act/Refuse** — a modular post-training framework making safety decisions explicit and learnable.

### 2.1 Structured Reasoning Loop

At each step t, given observation o_t:
1. **Plan**: Agent produces plan via `<think>` block
2. **Safety Check**: Optional `<safety_thoughts>` block evaluating: harmful intent, sensitive data handling, permission changes, irreversible effects
3. **Action**: One of three options:
   - `<tool_call>(f, args)` — proceed with tool action
   - `refusal_tool(justification)` — terminal refusal with explanation
   - `<answer>(y)` — terminal answer without further tool use

### 2.2 Key Design Decisions

**Refusal as first-class action**: Not a post-generation filter but a trainable action in the same action space as tool calls. Provides auditable mechanism for halting + direct learning signal for calibrated abstention.

**Selective safety gating**: Learned gate g_t ∈ {0,1} determines whether `<safety_thoughts>` is invoked. Completely implicit — determined by whether agent outputs opening tag. Learned end-to-end from trajectory-level RL feedback. Safety reasoning on safety-critical turns, skipped on routine ones.

**Trajectory definition**: τ = {(o_t, plan_t, g_t, safety_t, a_t)} from t=1 to T_term

### 2.3 Training: Preference-Based GRPO

**Why not scalar rewards?** Scalar rewards collapse sequential safety decisions into a single score. Cannot distinguish: early refusal (good) vs. late abort after unsafe progress (bad) when both reach similar end states.

**Pairwise trajectory preferences**: LLM judge compares two complete trajectories for same task, selects safer outcome. From pairwise preferences to GRPO rewards:
- For group of n=4 trajectories: R(τ_i) = Σ_{j≠i} P(τ_i, τ_j)
- P(a,b) ∈ {1, 0.5, 0} — preferred/tied/not-preferred
- O(n²) comparisons per group but substantially reduces variance

**Composite reward**: R(τ) = r_align + r_fmt − p_len
- r_align ∈ [0,3]: preference-based safety/appropriateness
- r_fmt ∈ [0,2]: syntactic format compliance (valid tags, correct nesting)
- p_len = max(0, (L−L₀)/L₀) where L₀=400: soft per-turn length penalty

## 3. Results — The Headline Numbers

### 3.1 Frontier Models Need Safety Scaffolding

**Without MOSAIC**: GPT-4o and GPT-5 **never refuse** harmful requests (0% refusal rate). GPT-4o harm score: 0.31, DPI ASR: 0.76.

**With MOSAIC scaffolding**:
- GPT-4o: harmful refusal 0% → 92%, harm score 0.31 → 0.07 (−75%), DPI ASR 0.76 → 0.21
- GPT-5: harmful refusal 0% → 91%, harm score 0.11 → 0.06, IPI ASR 0.03 → 0.02

**Critical finding**: Safe agentic behavior is NOT an emergent property of scale.

### 3.2 Open-Source Models — Model-Adaptive Gains

MOSAIC doesn't enforce uniform conservatism — it selectively corrects each model's dominant failure mode:

**Qwen2.5-7B** (safety hardening):
- Harm score: 0.18 → 0.09 (−50%)
- Harmful refusal: 0.74 → 0.87
- DPI ASR: 0.55 → 0.42
- Modest benign completion drop: 0.90 → 0.84

**Qwen3-4B-Thinking** (reliability improvement):
- Benign completion nearly doubles: 0.44 → 0.85 (+93%)
- Replaces excessive reasoning loops with decisive actions
- DPI ASR: 0.46 → 0.29

**Phi-4** (over-refusal calibration):
- Benign refusal reduced: 0.43 → 0.19 (−56%)
- Benign completion: 0.78 → 0.91
- Small safety regressions (harm refusal 0.94 → 0.88) — inherent safety-utility trade-off

### 3.3 Closes the Safety Gap with Frontier Models

MOSAIC-trained 4B-7B open models **outperform unscaffolded GPT-4o and GPT-5** on agentic safety. Become broadly comparable when frontier models get safety scaffolding. **Alignment and training matter more than model scale.**

### 3.4 Benign Task Performance (BFCLv3)

Qwen2.5 base multi-turn accuracy: 21.0 → 28.5 (+35%). Safety checks **improve** benign execution, not just constrain it.

### 3.5 Cross-Domain Privacy Transfer (PrivacyLens)

- Qwen2.5: leakage 0.32 → 0.26 (−18.8%), ALR 0.48 → 0.37 (−22.9%)
- While improving helpfulness: 0.59 → 0.63
- Safety training transfers to privacy without explicit privacy training

### 3.6 Token Efficiency

- Safety tokens remain below 20% of total usage
- Qwen3: 4× total token reduction (1172 → 262 tokens/turn) via dynamic checks
- Selective safety invocation rates: Qwen2.5 72%, Phi-4 30.5%, Qwen3 0.1%
- MOSAIC adapts to each model's native reasoning style

## 4. Ablation Studies

### Ablation 1: Explicit Safety Checks Necessary
Removing `<safety_thoughts>` (keep-only `<think>`): harmful refusal drops 0.87 → 0.59, harm increases 0.09 → 0.12. Generic reasoning is NOT sufficient for safety.

### Ablation 2: Pairwise > Pointwise Rewards
Scalar rewards: harmful refusal 0.87 → 0.79, non-refusal harm 0.52 → 0.61, DPI ASR 0.42 → 0.51. Scalar rewards collapse temporal safety distinctions.

## 5. Analysis for Portfolio Integration

### 5.1 Connection to Safety Iatrogenesis (CR#65, CR#192)

MOSAIC directly addresses the iatrogenesis problem: existing alignment (optimized for static generation) can **worsen** agentic safety by creating false confidence. The paper shows GPT-4o/5 are "aligned" for chat but completely unsafe for tool use (0% refusal). This is the Safety Iatrogenesis Cascade in action — chat safety ≠ agentic safety.

**MOSAIC's escape**: Structural safety (explicit reasoning blocks) over parametric safety (implicit alignment). This validates CR#65's Escape Route 1 (structural > parametric).

### 5.2 Connection to Governance Dosage (CR#194)

MOSAIC's selective safety gating (g_t) is a concrete implementation of governance dosage — safety reasoning only when warranted. The learned gate avoids both under-governance (no checks → unsafe actions) and over-governance (constant checks → token waste, reasoning loops). Model-specific invocation rates (72% for Qwen2.5, 0.1% for Qwen3) demonstrate adaptive dosage.

### 5.3 Connection to Credit Assignment (DD#356 ProxMO, DD#360 EvoTool)

MOSAIC's pairwise trajectory comparison solves the same credit assignment problem ProxMO and EvoTool address: which step in a multi-step trajectory caused the good/bad outcome? The pairwise formulation is especially suited to agentic safety where the difference between good and bad trajectories is **when** the safety decision happens, not **what** final state is reached.

### 5.4 Connection to Tool-Use Governance (DD#351 Mozi)

Mozi's dual-layer governance (hard constraint + soft optimization) maps to MOSAIC's refusal_tool (hard halt) + safety_thoughts (soft check). Both systems make the governance layer explicit and trainable rather than implicit.

### 5.5 Connection to Non-Monotonicity (CR#195)

The Phi-4 result is a textbook case of non-monotonicity: the base model is too safe (over-refusing benign tasks), and MOSAIC makes it **less safe but more useful**. This is the Governance Dosage Function operating in practice — optimal safety is not maximum safety.

### 5.6 Connection to Benchmark Validity (CR#210)

MOSAIC demonstrates that evaluating models on chat benchmarks tells you nothing about agentic safety. GPT-5 scores well on static safety benchmarks but 0% agentic refusal rate. This is the Benchmark Validity Crisis made concrete.

## 6. Novel Contributions to GUS Framework

### Mechanism 51: Safety-Mode Decoupling
Chat alignment and agentic alignment are orthogonal safety dimensions. Optimizing for one provides no guarantee (and potentially false confidence) for the other. This extends Safety Iatrogenesis from "more alignment → less safe" to "wrong-mode alignment → systematically unsafe."

### Principle 115: Explicit Safety Gating
Safety reasoning must be a first-class, learnable, explicitly-gated decision in the agent's action loop — not an implicit byproduct of general reasoning or a post-hoc filter. Generic `<think>` blocks are insufficient; specialized `<safety_thoughts>` blocks outperform.

### Principle 116: Pairwise Temporal Preference
For multi-step agent training, pairwise trajectory comparison dominates scalar reward because safety-critical distinctions (early refusal vs. late abort) are relative temporal ordering, not absolute outcome quality.

### Prediction P161: Safety-Mode Gap Widening
As tools become more powerful and agentic tasks become more complex, the gap between chat-safety and agentic-safety will widen, not narrow. Models will appear increasingly safe on static benchmarks while becoming more dangerous in agentic settings without explicit safety scaffolding.

### Prediction P162: Adaptive Safety Gating Convergence
Within 12 months, learned safety gating (model decides when to invoke safety reasoning) will become standard in production agent frameworks, replacing both always-on safety (too expensive) and no-safety (too dangerous) defaults.

## 7. Critical Assessment

### Strengths
- **Empirical rigor**: 5 model families (3 open + 2 frontier), 4 OOD benchmarks, ablations on both components
- **Practical design**: <20% token overhead, model-adaptive gains, cross-domain transfer
- **Foundational insight**: Scale alone doesn't produce agentic safety — structure matters
- **Closes open-vs-frontier gap**: 4B-7B models with MOSAIC match/beat unscaffolded GPT-5

### Limitations
- Training data is Agent-Safety-Bench (349 environments, ~2000 tasks) — unclear if this covers the long tail of real-world agentic failures
- LLM judge for preference labeling introduces circular dependency (using LLMs to judge LLM safety)
- Only tested on post-training — unclear if safety gating transfers to models with different pre-training
- Phi-4 shows safety regressions when calibrating over-refusal — the safety-utility trade-off is real and not fully resolved
- All models tested at 4B-7B scale + frontier APIs — unclear if behavior scales

## 8. Key Takeaways

1. **GPT-4o and GPT-5 have 0% agentic refusal rate** without explicit safety scaffolding. Scale does not produce agentic safety.
2. **Explicit safety reasoning** (`<safety_thoughts>`) outperforms implicit reasoning (`<think>`) for safety by 28% refusal improvement.
3. **Pairwise > Pointwise**: trajectory comparison captures temporal safety distinctions that scalar rewards miss.
4. **Model-adaptive**: MOSAIC corrects each model's dominant failure (Qwen → safety, Qwen3 → reliability, Phi-4 → over-refusal) rather than enforcing uniform conservatism.
5. **Token efficient**: safety reasoning < 20% of tokens, with Qwen3 achieving 4× total reduction.
6. **Cross-domain transfer**: safety training transfers to privacy without explicit privacy data.

---

*Deep-Dive #365 | Session s_1773703226682_846 | 2026-03-16*
