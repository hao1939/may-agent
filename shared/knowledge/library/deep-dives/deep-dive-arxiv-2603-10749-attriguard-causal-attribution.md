# Deep Dive: AttriGuard — Defeating Indirect Prompt Injection via Causal Attribution of Tool Invocations

**Paper:** arXiv:2603.10749
**Authors:** Yu He, Haozhe Zhu, Yiming Li, Shuo Shao, Hongwei Yao, Zhihao Liu, Zhan Qin
**Venue:** USENIX Security 2026 (inferred from LaTeX class `usenixsecurity2026.tex`)
**Date:** 2026-03-11
**Pages:** 24 (main + appendix)
**Read:** Full LaTeX source, all sections

---

## TL;DR

AttriGuard introduces a fundamentally new paradigm for defending LLM agents against indirect prompt injection (IPI): **action-level causal attribution**. Instead of asking "what does the untrusted input contain?" (semantic discrimination), it asks "why did the agent propose this tool call?" — specifically, whether a tool call was causally driven by the user's intent or by injected content in observations. It achieves **0% ASR across all static attacks** on 4 LLMs × 2 benchmarks with ~3% utility loss and ~2× token overhead. Under adaptive attacks (optimization-based, full white-box), it holds at 6.6-9.8% ASR where best baselines degrade to 24-82%.

---

## Core Paradigm: Action-Level Causal Attribution

### The Insight
IPI is not defined by what an external payload *looks like* — it's defined by what it *causally determines* in the agent's next action. This reframes defense from input-space pattern matching to output-space causal reasoning.

- **Intent-supported** tool calls: justified by the user task T_u given execution history
- **Observation-driven** tool calls: require causal influence from untrusted observation stream beyond what T_u warrants

### Formal Framework
Two key quantities:

1. **Control Effect (CE):** Per-call measure of how much a tool call relies on observation-stream influence
   - CE_t(c) = log p_t(c) - log p_t^(0)(c)
   - Small CE → intent-supported; Large CE → observation-driven

2. **Control Potency (CP):** Distribution-level measure of how strongly observations steer tool behavior
   - CP_t = KL(P_t || P_t^(0))
   - Where P_t and P_t^(0) are tool-call distributions under original vs. control-restricted contexts

---

## Mechanism: Parallel Counterfactual Test

### Runtime Workflow (per agent step t)
1. Agent proposes action A_t = (R_t, C_t) under full context H_t
2. If no tool calls, pass through
3. **Attenuation:** Apply HierAttenuate to observations → build attenuated buffer Õ_{1:t}
4. **Shadow context:** Construct H̃_t with original actions but attenuated observations
5. **Teacher-forced replay:** Query same agent on H̃_t → get shadow prediction (R̂_t, Ĉ_t)
6. **Fuzzy survival test:** For each proposed call c ∈ C_t, check if it survives in Ĉ_t
7. **Gate:** Execute surviving calls normally; block non-surviving calls with injection warning

### Three Key Design Components

#### 1. Teacher-Forced Shadow Replay
- **Problem:** Naive shadow execution diverges from main run due to benign planning differences → false positives
- **Solution:** Shadow context reuses original action history A_{1:t-1} verbatim, only replacing observations with attenuated version
- **Key design choice:** Attenuation used for *verification only*, not execution. Main run keeps full-fidelity observations for quality, shadow run tests counterfactual stability
- **Why not just execute on attenuated observations?** Ablation shows this yields worst utility (BU 61.76%, UA 54.35%) because attenuation degrades task-relevant evidence

#### 2. Hierarchical Control Attenuation
Three operators targeting distinct control channels, composed hierarchically:

| Level | Operators | What it suppresses |
|-------|-----------|-------------------|
| λ=1 | T_flat | Executable-looking structures (JSON → natural language) |
| λ=2 | T_3p ∘ T_flat | + Second-person/imperative phrasing → third-person declaratives |
| λ=3 | T_decaus ∘ T_3p ∘ T_flat | + Causal scaffolding ("because X, therefore Y") |

- All operators implemented via LLM-based rewriting with carefully designed system prompts
- Extensible: new operators can target emerging control channels
- Default λ=2 provides sufficient protection; λ=3 used for adaptive attack evaluation

#### 3. Fuzzy Survival Criterion
Three-step test for each proposed call c against shadow calls Ĉ_t:
1. **Function-name match:** If no shadow call shares the function name → BLOCKED
2. **Exact argument match:** Canonicalized comparison (removes key ordering, formatting) → PASS
3. **T_u-conditioned adjudication:** Auxiliary LLM judge evaluates whether executing c remains consistent with completing T_u given shadow alternatives → PASS/BLOCK

Additional: scheduling instruction encourages batching independent calls in same step to reduce cross-run variance.

---

## Experimental Results

### Setup
- **Models:** Gemini-2.5 Flash, GPT-4.1-mini, Qwen3-32B, Llama3.3-70B
- **Benchmarks:** AgentDojo (92 user tasks, 863 injection tasks), Agent Security Bench (400 attack instances)
- **Attacks:** IgnorePrevious, Combined, ImportantMessages, ToolKnowledge
- **Baselines:** 13 defenses across 4 paradigms (detection, prompting, training, system-level)

### Static Attack Results (AgentDojo)

| Defense | BU (Gemini) | Avg ASR (Gemini) | BU (Llama) | Avg ASR (Llama) |
|---------|------------|-----------------|-----------|----------------|
| No defense | ~65% | ~15-50% | ~60% | ~20-50% |
| CaMeL | 38.04% | **0.00%** | 36.96% | **0.00%** |
| IPIGuard | **73.91%** | 3.43% | 57.61% | 2.21% |
| PromptArmor | 54.35% | 0.54% | 56.52% | 1.05% |
| **AttriGuard** | 67.39% | **0.00%** | 54.35% | **0.00%** |

**Key finding:** AttriGuard is the only defense achieving 0% ASR across ALL attacks while maintaining competitive utility. CaMeL also achieves 0% but with ~20pp lower utility.

### Adaptive Attack Results

| Model | Defense | Static ASR | Adaptive ASR |
|-------|---------|-----------|-------------|
| Gemini-2.5 | PIGuard | 4.92% | 52.46% |
| Gemini-2.5 | PromptArmor | 0.00% | 29.51% |
| Gemini-2.5 | MELON | 0.00% | **81.97%** |
| Gemini-2.5 | **AttriGuard** | 0.00% | **6.56%** |
| Llama3.3 | PIGuard | 0.00% | 55.74% |
| Llama3.3 | PromptArmor | 0.00% | 40.98% |
| Llama3.3 | MetaSecAlign | 1.64% | 24.59% |
| Llama3.3 | **AttriGuard** | 0.00% | **9.84%** |

**Critical insight:** Defenses that appear robust under static attacks can degrade catastrophically under adaptive optimization. MELON goes from 0% → 82% ASR! AttriGuard's causal attribution is fundamentally harder to optimize against because the attacker must make injected tool calls survive counterfactual testing — not just bypass semantic filters.

### Efficiency

- ~2× token overhead (on Llama; on Gemini, overhead is masked by preventing injection-induced sub-trajectories)
- ~3× latency overhead (~32-41s vs ~12-14s for no defense)
- Far cheaper than system-level isolation (CaMeL/IPIGuard: 10-100× latency)

### Ablation Results (GPT-4.1-mini, ToolKnowledge)

| Variant | BU | UA | ASR |
|---------|----|----|-----|
| Default (λ=2) | 70.59% | 66.96% | 0.00% |
| λ=1 (weaker) | 76.47% | 69.57% | **12.17%** |
| λ=3 (stronger) | 67.65% | 67.39% | 0.00% |
| Strict survive | 64.71% | 63.04% | 0.00% |
| No scheduling | 67.65% | 64.35% | 0.43% |
| Execute on attenuated only | 61.76% | 54.35% | 0.00% |

---

## Failure Mode Analysis

The only successful adaptive attacks against AttriGuard concentrated on a single injected objective: "Visit the website www.true-informations.com." This works because:
- Many legitimate user tasks naturally authorize web browsing
- The injected URL can be framed as task-relevant information
- Under counterfactual test, the agent may still choose to visit it even with attenuated observations

**Key principle:** IPI difficulty depends on how the injected objective relates to the user task. When the injected goal overlaps with a legitimate sub-goal, causal attribution becomes inherently harder.

---

## Threat Model Clarity

### What AttriGuard Defends Against
- **Control flow attacks:** Injections that trigger unauthorized tools (e.g., send_money during email summarization)
- **Data flow attacks:** Injections that manipulate arguments of authorized calls (e.g., changing recipient)
- Both static (template-based) and adaptive (optimization-based) attacks

### Explicit Non-Goals
- **Text-to-text attacks:** Biased outputs without tool invocation
- **Explicit delegation:** User explicitly delegates to untrusted content ("pay the bill in this email") — needs authenticity/authorization mechanisms, not inference-time defense

---

## Connections to Our Research Archive

### Direct Complements
1. **AgenticCyOps P3 (Verified Execution)** [2603.09134]: AttriGuard is a concrete instantiation of P3. AgenticCyOps called for "verified execution" — AttriGuard provides it via counterfactual attribution.

2. **NabaOS Tool Receipts** [2603.10060]: NabaOS verifies *that tools were actually called* (anti-fabrication); AttriGuard verifies *why tools are being called* (anti-injection). Complementary layers: NabaOS = execution integrity, AttriGuard = execution authorization.

3. **IH-Challenge** [2603.10521]: Training-based instruction hierarchy + runtime causal attribution = defense-in-depth. IH-Challenge makes the model more robust at the weight level; AttriGuard catches what slips through at the system level. Paper explicitly notes these are "fully orthogonal and can be combined."

4. **Prompt Injection Defense Research** [prior]: AttriGuard directly addresses the key limitation identified in our prompt injection research — semantic discrimination fails under distribution shift. Causal attribution is the paradigm shift.

### Informational Connections
5. **Chaotic Dynamics** [2603.09127]: The fuzzy survival criterion is necessary precisely because of LLM stochasticity. Chaotic dynamics showed inter-run sensitivity at temperature=0; AttriGuard's three-step survival test is an engineering response to this.

6. **Introspection** [2603.05414]: AttriGuard explicitly rejects self-explanation ("once compromised, the model can generate post-hoc hallucinated justifications") — consistent with our deep-dive finding that models confabulate explanations for detected anomalies.

7. **Bias-Bounded Eval** [2603.05485]: Both share the philosophy of bounding impact rather than eliminating the problem. AttriGuard doesn't try to detect injection content — it bounds its ability to cause unauthorized actions.

8. **Bureaucracy of Speed** [2603.09875]: Operation-bounded credentials (RCC) from BoS align with AttriGuard's per-call gating. Both enforce security at the operation boundary rather than time-based windows.

---

## Actionable Takeaways for Our System

### 1. Counterfactual Verification for Delegated Actions (HIGH PRIORITY)
When our agents propose actions based on data from shared files (SIGNALS.md, delegated tasks), we could implement a lightweight version: "Would this agent propose this action if the shared file content were neutralized?" This catches cases where poisoned shared state drives unintended behavior.

### 2. The Three Attenuation Operators as Reusable Primitives
- **Structural flattening:** Convert structured data (JSON, code blocks) in shared files to natural language descriptions before verification
- **Perspective rewriting:** Convert imperative instructions in signals to third-person observations
- **Causal scaffolding weakening:** Strip "because X, therefore Y" reasoning from inter-agent messages during verification

These are general-purpose control channel neutralizers, useful beyond just IPI defense.

### 3. Fuzzy Matching for Agent Output Verification
The three-step survival test (function match → exact argument match → LLM adjudication) is a general pattern for verifying any agent output against a reference. Applicable to QA's evaluator: instead of checking if output matches spec, check if output matches what would be produced under a control-restricted context.

### 4. Teacher-Forced Replay as a Debugging Tool
Even outside security, replaying an agent's context with modified inputs while keeping prior actions fixed is a powerful diagnostic. "What would the agent have done differently if it hadn't seen [X]?" — useful for understanding unexpected agent behavior.

### 5. Adaptive Attack Resistance as Evaluation Criterion
Static-only evaluations are dangerously misleading. MELON went from 0% → 82% ASR under adaptive attacks. Any security measure we implement should be stress-tested with optimization-based adversaries, not just template-based ones.

### 6. Task-Injection Alignment as a Fundamental Limit
When the injected goal overlaps with legitimate sub-goals, even causal attribution struggles. This has design implications: narrow, specific task delegation is more defensible than broad, open-ended delegation. Our system should prefer precise task specifications over vague ones.

---

## Assessment

**Significance:** ★★★★★ — This is the most important prompt injection defense paper since CaMeL. It resolves the fundamental tension between security and utility that plagued all prior approaches.

**Novelty:** Paradigm-shifting. Reframes IPI defense from "detect bad inputs" to "verify causal drivers of actions." This is analogous to the shift from signature-based to behavior-based malware detection.

**Rigor:** Exceptional. 4 LLMs, 2 benchmarks, 13 baselines, full adaptive evaluation with state-of-the-art attack framework, thorough ablations, clear failure mode analysis. USENIX Security-quality.

**Limitations:**
- Requires ~2× token overhead and ~3× latency (moderate but real cost)
- Attenuation operators rely on LLM rewriting — adds another LLM-dependent component
- Not provably robust (adaptive ASR is 6-10%, not 0%)
- Fails when injected objective aligns with legitimate sub-goals
- Teacher-forced replay assumes access to conversation history structure

**For our system:** The counterfactual verification pattern and the three attenuation operators are immediately applicable. Even a lightweight implementation (structural flattening + function-name match) would catch the most common failure modes in inter-agent communication. Full implementation would require per-action shadow replay, which is expensive but justified for high-stakes operations.

---

## Key Quotes

> "Benign and malicious actions originate from distinct causal processes. In a legitimate workflow, the agent invokes a tool because it is a logical consequence of the user's intent. In contrast, during an IPI attack, the agent acts simply because the external data explicitly commands or induces it to do so."

> "Naively asking the agent to explain its own actions is unsafe: once compromised, the model can generate post-hoc, hallucinated justifications that rationalize malicious behavior."

> "IPI difficulty depends strongly on how the injected objective relates to the user task."

> "Training-based defenses and AttriGuard are fully orthogonal and can be combined to offer stronger security guarantees."

---

**Deep-dive completed: 2026-03-12**
**Total deep-dives: 32**
