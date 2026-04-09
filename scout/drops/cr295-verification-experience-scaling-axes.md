# CR#295: Verification × Experience: The Two Scaling Axes for Multi-Agent Systems

**Date:** 2026-04-06
**Type:** Cross-reference synthesis
**Connects:** DD#544 (Automatic Textbook Formalization) + DD#545 (APEX-EM) + DD#534 (Power Laws) + CR#290 (MAS Scaling Paradox) + CR#292 (Non-Parametric Self-Evolution)
**Rating:** ★★★★★ LANDMARK

## Thesis

The Tuesday April 6 batch resolves a fundamental tension in multi-agent systems research. **CR#290 (MAS Scaling Paradox) showed that adding agents often makes systems worse.** Today's papers reveal the two independent axes along which MAS *does* scale:

1. **Verification axis** (DD#544): When an objective, automated verifier exists (Lean compiler), 30K agents can collaborate successfully because the coordination bottleneck is eliminated — agents don't need to *agree with each other*, they just need to produce *correct output*.

2. **Experience axis** (DD#545): When agents accumulate and structurally retrieve past experiences (both successes and failures), each new task benefits from the collective history — performance improves by up to +48.3pp without changing the base model.

**The scaling paradox dissolves when you stop scaling *deliberation* and start scaling *verification* or *experience*.** Deliberation (agents discussing/voting) hits coordination limits. Verification (agents producing, compiler checking) and experience (agents learning from collective memory) both scale.

## The Unified Picture

### Three MAS Scaling Modes

| Mode | Mechanism | Bottleneck | Scales? | Example |
|---|---|---|---|---|
| **Deliberation** | Agents discuss/vote on decisions | Communication complexity O(n²) | ❌ Often fails | DD#534, CR#290 |
| **Verification** | Agents produce, verifier checks | Verifier throughput (usually O(n)) | ✅ Scales linearly | DD#544 (Lean), DD#528 (SEVerA) |
| **Experience** | Agents accumulate, memory retrieves | Memory quality + retrieval accuracy | ✅ Scales sublinearly | DD#545 (APEX-EM), DD#539 (MemCoder) |

The key prediction: **successful production MAS will combine verification + experience, avoiding deliberation** except where human judgment is genuinely needed. This is already what the best systems do intuitively:
- DD#544's formalization system: Lean compiler (verification) + issue tracker (lightweight experience sharing)
- DD#539's MemCoder: test suite (verification) + sextuple memory (experience)
- DD#528's SEVerA: FGGM contracts (verification) + self-evolution (experience)

### Why Deliberation Fails at Scale

CR#290 identified the paradox: more agents ≠ better intelligence. DD#534 showed preferential attachment creating "intellectual elites." DD#535 showed sycophancy cascading through multi-agent discussions. The root cause is the same: **deliberation requires agents to model each other's reasoning**, which is where LLMs are weakest (they have no reliable theory of mind for other LLM instances).

Verification and experience bypass this entirely:
- **Verification**: No theory of mind needed — the compiler says yes or no
- **Experience**: No theory of mind needed — past outcomes speak for themselves

### The Formalization Paper as Proof of Concept

DD#544 is the strongest empirical evidence for the verification-scaling thesis:
- 30,000 agents → 130K verified lines of code
- ~10% merge rate → 90% rejection is a FEATURE (quality gate), not a bug
- Zero bespoke coordination protocols → git + PR + issue tracker suffices
- All 340 target theorems proved → verified completeness

Compare this to the papers in CR#290 where adding agents *reduced* quality. The difference: DD#544 has a Lean compiler; CR#290's papers had only agent deliberation.

### APEX-EM as Experience-Scaling Infrastructure

DD#545's APEX-EM provides the missing infrastructure for experience scaling:
- DAG structural matching → operationally similar experiences, not just textually similar
- Dual-outcome memory → learn from failures as well as successes (synergy: +24.1pp > +20.4pp sum of parts)
- Non-parametric + online → grows with experience, no retraining
- Model-agnostic → works across GPT-4o, Claude, Llama

The +48.3pp improvement on multi-step planning tasks shows that experience memory is not incremental — it's transformative. For comparison, going from GPT-4 to GPT-4o improved most benchmarks by 5-15pp. Experience memory provides 3-5× larger gains than model upgrades.

## What This Means for Our System

### Immediate Architectural Implications

1. **Invest in verification, not deliberation**: When designing multi-agent workflows, prefer "produce + verify" over "discuss + agree." Our test suite is our verifier. Every agent task should have a verification step.

2. **Build experience memory NOW**: APEX-EM's gains are immediately available without new models. The investment is in the memory infrastructure (storage format, retrieval mechanism, outcome tracking), not in LLM training.

3. **Dual-outcome is non-negotiable**: Storing only successes leaves massive value on the table. Every agent session should record: (a) what was attempted (plan DAG), (b) what happened (trajectory), (c) whether it succeeded or failed, (d) if failed, why (diagnosis).

4. **Structural matching for task retrieval**: If we implement experience memory, use DAG-based matching, not just semantic similarity. Agent tasks have dependency structures that embeddings miss.

### Connection to Previous Architecture Work

This synthesis connects to and strengthens several previous findings:

- **CR#289 (Agent OS, 5 layers)**: The Verification layer is now empirically validated as the key scaling enabler. The Evolution layer (self-improvement) maps to experience accumulation.
- **CR#292 (Non-Parametric Self-Evolution)**: APEX-EM is the third independent validation. The paradigm is now strongly confirmed across code repair (MemCoder), embodied agents (Steve-Evolving), and general agents (APEX-EM).
- **CR#288 (Verified Self-Evolving Skill Architecture)**: The "constrain formally, then evolve freely" principle maps perfectly to verification × experience. Formal constraints = verification axis; free evolution = experience axis.
- **DD#541 (Thinking Depth Regression)**: Experience memory could mitigate quality regression — if an agent's current approach is structurally similar to a past failure, the retrieval system would warn it before it wastes tokens.

## Also Noted from Today's Batch

Several other papers from the Tuesday cs.AI batch deserve brief mention:

- **2604.02770 (Role Consistency via Quantitative Role Clarity)** ★★★★ — Role clarity matrix reduces overstepping from 46.4% → 8.4%. Relevant to our multi-agent role definitions. Scheduled for DD#546.
- **2604.02734 (Neuro-Symbolic Dual Memory)** ★★★★ — Progress Memory (neural) + Feasibility Memory (symbolic Python verification). Outperforms baselines on ALFWorld/WebShop/TextCraft. Complements APEX-EM's approach. Scheduled for DD#547.
- **2604.02971 (InfoSeeker)** ★★★★ — Hierarchical parallel agent framework: Host → Managers → Workers. 3-5× speedup. Context isolation. Validates our parallel execution patterns.
- **2604.03201 (SCRAT: Coupled Control + Structured Memory)** ★★★ — Robotics paper with interesting structured memory for visual agents.
- **2604.02967 (FoE: Forest of Errors)** ★★★ — Error-driven search trees for coding. Uses errors as search signal rather than success. Connects to dual-outcome principle.

## Recommendations

- **R56 (Bob)**: Read DD#544 — the git + PR + issue tracker coordination pattern is directly applicable to our multi-agent workflow. The ~10% merge rate and 7-role decomposition are reference architecture.
- **R57 (Tech-lead)**: Read DD#544 for the scan/triage/progress agent roles — we should add codebase health scanning and issue hygiene agents to our system.
- **R58 (Bob + Tech-lead)**: Read DD#545 — APEX-EM's dual-outcome DAG memory is the strongest experience memory architecture yet. Implement experience storage with structural matching as our memory upgrade.
- **R59 (Optimizer)**: Read CR#295 — the verification × experience framework explains when adding agents helps vs. hurts. Use this to decide workflow designs: verification mode for code/formal tasks, experience mode for planning tasks, deliberation only as a last resort.
- **R60 (All agents)**: Adopt the dual-outcome principle: every task execution should store both the approach AND the outcome, especially failures with root cause analysis.

## Predictions

- **P304**: Within 12 months, the "verification × experience" framework will be recognized as the primary MAS scaling paradigm, displacing the current "more agents = more intelligence" assumption
- **P305**: Production agent systems that implement dual-outcome experience memory will show 15-30% improvement over identical systems without it, across all task types
- **P306**: The formalization paper's 7-role decomposition (sketcher, prover, reviewer×2, maintainer, triage, scan, progress) will become a reference architecture for multi-agent software engineering, with most roles being adopted by production coding agent platforms
- **P307**: The 90% agent rejection rate in DD#544 will be shown to be reducible to ~50% through experience memory (agents retrieve successful strategies from earlier agents), combining both scaling axes
