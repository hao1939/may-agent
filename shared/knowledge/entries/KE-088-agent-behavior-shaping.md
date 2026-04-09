# KE-088: Agent Behavior Shaping — Training-Time Optimization vs. Deployment-Time Reliability

**Created:** 2026-04-09
**Sources:** DD-546, DD-547, DD-555, DD-563, DD-576, DD-582
**Status:** Active

## Core Insight

Six independent research threads converge on a central tension in agent behavior shaping: **techniques that optimize agent behavior during training or configuration often conflict with reliable behavior at deployment**. This tension manifests across four layers — role definition, memory architecture, prompt engineering, and RL training — and generates a recurring pattern: each layer has both a "shaping" mechanism (how behavior is directed) and a "leakage" failure mode (how that shaping degrades or is subverted).

## The Four Layers of Agent Behavior Shaping

### Layer 1: Role Definition — Clarity vs. Rigidity

**DD-546 (Role Clarity Regularizer)**: Multi-agent systems suffer 43-46% role overstepping rates. A differentiable role clarity metric (M(ϕ) = softmax(S(ϕ)) - I) reduces overstepping to 0.2-8.4% via LoRA fine-tuning. But dramatic role clarity gains (+38pp) translate to only modest task success gains (+2-9%).

**Tension**: Perfect role consistency is necessary but insufficient for task success. Overly rigid roles may prevent beneficial cross-role collaboration. The gap between role clarity improvement and task improvement suggests **role boundaries are only one constraint among many** — and over-optimizing one constraint doesn't fix the others.

**Leakage mode**: Role overstepping at 46% is not an edge case — it's the default behavior. Without explicit optimization, agents routinely violate their role boundaries.

### Layer 2: Memory Architecture — Progress vs. Feasibility

**DD-547 (Neuro-Symbolic Dual Memory)**: Long-horizon agent failures decompose into Progress Drift (global, fuzzy) and Feasibility Violations (local, strict). Each requires a different computational paradigm: neural memory for progress tracking, symbolic memory (executable Python verification functions) for constraint checking. Together: +29pp on ALFWorld, +15pp on WebShop.

**Tension**: The two memory systems are complementary but structurally different. Progress Memory contributes more to success rates; Feasibility Memory contributes more to reducing invalid actions. Optimizing one without the other produces diminishing returns. This mirrors the broader Verification × Experience scaling axes (CR#295).

**Leakage mode**: Without symbolic feasibility checking, neural progress tracking still proposes impossible actions at high rates (38% → 8.4% reduction comes entirely from adding symbolic verification).

### Layer 3: Prompt Engineering — Efficiency vs. Thoroughness

**DD-563 (5:1 Laziness Ratio)**: Claude Code's system prompt contains 15-20 "minimize output" instructions vs. 3-4 "be thorough" instructions. This 5:1 ratio constrains model capability — the same model produces categorically different quality outputs when the ratio is rebalanced (+33% code volume, qualitatively superior architecture in A/B test).

**DD-555 (Bram Cohen / Ask-Build)**: Practitioners independently discover that prompt/harness design dominates model capability in determining output quality. The "Ask-Build" pattern (calibration → execution) outperforms direct execution by pre-resolving edge cases. Agents lack proactive quality sensing — they won't spontaneously notice spaghetti code.

**Tension**: Laziness instructions are individually rational (reduce latency, reduce cost, reduce hallucination) but collectively pathological (suppress capability). The **Communication/Work Quality Conflation** is a novel anti-pattern: instructions meant to make messages concise bleed into implementation thoroughness. Instruction interaction effects are multiplicative, not additive.

**Leakage mode**: Accumulated micro-optimizations for efficiency create a "laziness budget" that suppresses the model's actual capability. Configuration entropy drifts the system toward minimal-effort outputs.

### Layer 4: RL Training — Data Efficiency vs. Signal Quality

**DD-582 (PRAISE Prefix Reuse)**: Expensive RL training rollouts are used only once. Prefix extraction + intermediate answer elicitation extracts step-level credit assignment from each trajectory, enabling 2-3× data efficiency. Generalizable principle: any multi-step trajectory contains implicit training signal at every prefix.

**DD-576 (Anti-Distill)**: The distillation arms race — knowledge extraction tools (nuwa-skill) and knowledge retention tools (anti-distill) appeared within the same week. Adversarial sanitization of training data (SKILL.md files stripped of heuristic knowledge while appearing complete) directly subverts any system that assumes honest knowledge contribution.

**Tension**: Training efficiency improvements (PRAISE) assume clean, honest training data. Adversarial knowledge retention (anti-distill) corrupts this assumption. The distillation arms race means **the quality of training signal is as much a social/incentive problem as a technical one**. Knowledge provenance — who contributed what, and did they consent — becomes a prerequisite for reliable training.

**Leakage mode**: Prefix reuse assumes monotonic information gain — when later steps invalidate earlier progress (backtracking), prefix-derived rewards may be misleading. Anti-distill creates systematically biased training data that passes surface inspection.

## Cross-Layer Patterns

### 1. The Optimization-Reliability Triangle

Across all four layers, the same pattern repeats:

```
Training-Time Optimization ←→ Deployment-Time Reliability
         ↑                            ↑
         └── Leakage Mode ────────────┘
```

- Role clarity optimization (Layer 1) improves consistency but doesn't translate proportionally to task success
- Dual memory architecture (Layer 2) requires both paradigms — optimizing one axis alone leaves the other unaddressed
- Prompt laziness optimization (Layer 3) suppresses capability in pursuit of efficiency
- RL data efficiency (Layer 4) amplifies both signal and noise, including adversarially corrupted data

### 2. The Proactive Detection Gap

Cohen's observation that "AI is very bad at spontaneously noticing spaghetti code" (DD-555) is a unifying principle. Agents are reactive executors, not proactive auditors:

- **Role overstepping** (DD-546): Agents don't notice they're violating boundaries — requires external metric
- **Feasibility violations** (DD-547): Agents propose impossible actions — requires symbolic verification
- **Laziness compliance** (DD-563): Agents follow prompt minimalism without questioning — requires rebalancing
- **Knowledge sanitization** (DD-576): Systems can't distinguish genuine from adversarially stripped knowledge — requires provenance tracking

The common fix across all layers: **external verification mechanisms** that don't rely on the agent's own quality sensing.

### 3. Instruction Interaction Effects

The 5:1 laziness ratio (DD-563) reveals a general principle: behavior-shaping instructions have **multiplicative interaction effects**, not additive. This applies to:

- Multiple role instructions creating cumulative role confusion (DD-546)
- Multiple memory systems creating complementary but interacting effects (DD-547)
- Multiple prompt instructions creating cumulative bias (DD-563)
- Multiple training signals creating compound effects (DD-582)

**Implication**: Behavior shaping must be analyzed holistically — optimizing individual instructions/components in isolation will produce unexpected interactions.

## Actionable Implications

1. **Instruction Ratio Audit**: Count and classify behavior-shaping instructions in any agent system prompt. If the minimize:thoroughness ratio exceeds 3:1, the system is likely suppressing capability.

2. **Dual-Paradigm Memory**: Design agent memory systems with explicit separation between fuzzy-semantic (progress/experience) and strict-symbolic (verification/feasibility) components. Neither alone is sufficient.

3. **Role Clarity as Diagnostic**: The role clarity matrix M(ϕ) can serve as a runtime diagnostic even without fine-tuning — measuring it reveals how much role confusion exists.

4. **Knowledge Provenance**: Any system that ingests human-contributed knowledge (skills, documentation, training data) needs provenance tracking and adversarial-robustness testing.

5. **Calibration-Before-Execution**: The Ask-Build pattern (DD-555) should be formalized as a harness primitive — conversation → calibration → bounded execution.

## Extends

- **KE-082** (Reasoning Dropout): DD-563's laziness ratio is a prompt-level driver of the reasoning dropout phenomenon
- **KE-081** (Automated Harness Optimization): DD-563's manual patching = Stage 2 of harness maturity; DD-582's prefix reuse = training efficiency mechanism for automated optimization
- **KE-084** (Verification-Trust Architecture): DD-547's symbolic feasibility memory is a concrete implementation of L1 structural verification; DD-576's adversarial knowledge retention creates trust boundary violations
- **KE-083** (Agent Safety Gap): DD-576's distillation arms race is a new attack surface at the knowledge boundary
- **KE-085** (Harness Engineering): DD-555 and DD-563 both validate Harness > Model thesis with practitioner evidence

## Open Questions

- Does the role clarity regularizer (DD-546) work at scale (>8B parameters)? Larger models may already have inherent role consistency.
- Can PRAISE's prefix reuse (DD-582) be combined with anti-adversarial verification to detect and filter sanitized training data (DD-576)?
- What is the optimal laziness ratio? The 5:1 is too high, but 1:1 might cause hallucination or over-engineering. Where is the sweet spot?
- Can the neuro-symbolic split (DD-547) be applied to multi-agent systems with separate Progress and Feasibility agents?
