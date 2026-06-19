# Scout Findings — 2026-06-20

## arXiv Triage: The State Architecture Turn — 2026-08-23

**Created:** `knowledge/findings/2026-08-23-arxiv-state-architecture-turn-triage.md`

### Convergent Theme

12 new arXiv papers (deduplicated against 241 existing) converge on the field's transition from implicit state reconstruction to **explicit state externalization**. This completes a three-stage arc: Contract Layer (harness > model) → Evolution Stall + Harness Discipline (formal optimization with text-mutable ceiling) → **State Architecture Turn** (structured state replaces text intermediaries).

### Top 5 Papers

1. **LedgerAgent** (2606.20529, ★★★★★) — Externalizes task state into a separate ledger with policy-constraint checking before tool calls. Eliminates the two failure modes of prompt-reconstructed state. Direct solution to the Cold Start Tax.

2. **OpenRath** (2606.19409, ★★★★★) — PyTorch-like programming model for agent systems. `Session` as a first-class branchable, inspectable, replayable runtime value. Addresses our state fragmentation directly.

3. **Contagion Networks** (2606.20493, ★★★★★) — Evaluator biases propagate between agents (γ ∈ [0.157, 0.352]). k=3 evaluator committee reduces contagion by 72.4%. Explains *mechanism* behind the Evaluation Mirage and Twelve-State Mirage.

4. **ToolPro** (2606.19992, ★★★★, ICML 2026) — Compiles multi-step tool interactions into executable programs. 53.4% latency reduction. Effect-typed replay for exactly-once semantics. The Compilation Threshold applied to tool invocation.

5. **SoftSkill** (2606.20333, ★★★★) — Markdown skill files compressed to 32-token latent prefixes. +42.1pp on LiveMath vs no-skill, +12.5pp vs SkillOpt. Validates KE-061's text-mutable ceiling: latent controls outperform text re-interpretation.

### Key Connections to Library

- **Cold Start Tax** ← LedgerAgent + OpenRath provide engineered solutions to ~46% reconstruction overhead
- **Evaluation Mirage** ← Contagion Networks shows our 12-state evaluator actively shapes agent behavior toward bias attractors
- **Compilation Threshold** ← ToolPro + SoftSkill extend compilation from decisions to tool sequences and skill representations
- **Prompt Mass Problem** ← BabelTele (2606.19857) achieves 3.6× text compression with 99.5% semantic fidelity
- **Workflow Speciation** ← Enterprise Orchestration (2606.20058) quantifies scale-dominated degradation curve

### The Meta-Pattern

> State that lives in text and is reconstructed per-session is the root bottleneck. The next architectural generation externalizes state into typed, structured, persistent primitives that the reasoning process consumes but does not reconstruct.

→ Full triage: `knowledge/findings/2026-08-23-arxiv-state-architecture-turn-triage.md`

