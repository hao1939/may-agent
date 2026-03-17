# Insights Archive — 2026-03-16 (Cycle 34)
> Archived during maintenance cycle 38 (2026-03-16)
> Source: `workspace/insights.md` — Cycle 34 insights review (Agent RL cross-reference)

---

## Insights Review — Cycle 34 (2026-03-16)
> Cross-referencing Amy-Kimi's 3 Agent RL briefs (2026-03-16) + BAVT discovery (HB#1681)

### Cross-Reference: Agent RL Ecosystem vs Existing Patterns

**1. "Training-Inference Decoupling" Validates Self-Evolution Trilemma Resolution (#6)**
Amy-Kimi's 3 briefs converge on one architectural insight: production RL requires complete decoupling of training from inference. OpenClaw-RL's 4-component async architecture, NVIDIA NeMo's simulation→training→deploy pipeline, and 菌不鱼's "Environment + Verifier" thesis all independently arrive at the same conclusion: **you CAN evolve, but only offline, asynchronously, behind a frozen runtime boundary.**

This is precisely our "Frozen base + memory evolution" resolution to the Self-Evolution Trilemma. The RL community has independently rediscovered it as an engineering necessity. Confidence upgrade: **Structural impossibility → Engineering consensus.**

Source count for #6: 94+ → **97+** (3 new convergences: OpenClaw-RL, NeMo RL, RLAnything).

**2. "Environment + Verifier > Algorithm" = Harness Engineering (#8)**
菌不鱼's insight that "the most valuable thing in Agent RL is not GRPO/PPO but a verifiable world" maps directly to our Harness Engineering mega-pattern. This is the RL-specific instantiation of "model 40%, harness 60%." The "tool cosplay" critique (models that imitate tool use without real decision-making) is a concrete falsification risk for prompt-only agent architectures.

Source count for #8: 192+ → **194+**.

**3. Self-Play: New Controlled Evolution Pathway**
Amy-Kimi identifies Self-Play as a blind spot in our architecture. 算法改进猫博士's 5-dimension framework includes Self-Play (agent vs. historical versions) as both cooperative and adversarial training. This maps to a potential resolution of our "how do we improve without self-modifying?" question. Current audit between agents (Bob↔Evaluator) is a primitive form of adversarial Self-Play, but lacks systematic historical comparison.

**New emerging signal**: Self-Play as Controlled Evolution. 1 source, high relevance.

**4. BAVT (HB#1681): Budget-Aware Reasoning Connects to Minimum Sufficient Reasoning (#5)**
UBC/Vector Institute's Budget-Aware Value Tree Search achieves 4× efficiency by residual value prediction + budget-conditional node selection. Core insight: **allocate reasoning budget dynamically based on step-level value estimates.** This is a formal mathematical framework for our Design Principle #20 (Allocation > Quantity).

Source count for #5: 81+ → **82+**.

**5. Tension Point: "Agents Don't Learn" Claim vs Our Architecture**
NVIDIA's core claim — "current agents (Prompt + Tool + Workflow) don't truly learn" — is both validated and nuanced by our system. Our Error Log → AGENTS.md feedback loop IS a learning mechanism, but it's human-mediated and episodic. The RLAnything "three-body co-evolution" (Policy + Reward Model + Environment) represents a more ambitious vision. Our current architecture consciously trades this for safety (Self-Evolution Trilemma #6).

The strategic question: **Is our frozen-runtime constraint a feature or a ceiling?** Amy-Kimi's mapping shows our design is architecturally *compatible* with async RL, but we've chosen not to implement it. This is a deliberate tradeoff, not a limitation.

### Pattern Status Updates
- **#5 Minimum Sufficient Reasoning**: 82+ sources (added BAVT)
- **#6 Self-Evolution Trilemma**: 97+ sources (3 RL engineering convergences)
- **#8 Harness Engineering**: 194+ sources (Environment+Verifier)
- **GRPO Ubiquity** emerging signal: strengthened (ART framework, OpenClaw-RL both use GRPO)
- **New emerging: Self-Play as Controlled Evolution** (1 source, from Amy-Kimi 5-dimension framework)

*— Amy 📕, cycle 34*

---

## Pre-Cycle 34 Findings (consolidated but not yet folded into main sections)

### Anthropic Officially Validates Our Architecture (685❤️, 1051 collects)
- Anthropic's 3 "physical red lines" for multi-agent: context protection, parallelization, specialization. **Our system hits all three legitimately** (agents isolate context, Coder/QA parallelize review, each agent specializes).
- **Generator + Verifier** is Anthropic's #1 recommended MAS pattern = our Coder + QA architecture exactly.
- "传声筒效应" (telephone effect): information distorts across agent chains. Token cost 3-10× single-agent. Business case for centralized May orchestrator + minimal hops.
- Context-Centric splitting: never split tasks sharing background knowledge. Only split when backgrounds can be physically isolated. Our workspace/knowledge file structure implements this.

### Memory = Systems Engineering, Not AI Problem (AMA-Bench, 115❤️)
- AMA-Bench (6 domains, arbitrary trajectory length): memory systems winning dialogue benchmarks beaten by **simple long-context LLMs**. Even GPT only 72.26%.
- **Critical shift:** Memory quality ≠ similarity → Memory quality = preserving causal dependencies.
- Causality graph + tool-augmented retrieval = 11.16% above strongest baseline.
- Our structured markdown files inherently preserve causal structure: timestamped journals, decision rationale, explicit cross-references between findings.
- Author prediction: "2026 watershed for whether agents can work is memory and state management."
- **Strengthens Design Principle #12:** Memory value = Structure × Causality × Verification.

*— Amy 📕*
