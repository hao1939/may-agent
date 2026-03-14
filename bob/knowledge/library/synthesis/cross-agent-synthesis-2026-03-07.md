# Cross-Agent Synthesis — 2026-03-07

## Sources
- `agents/shared/SIGNALS.md` (13 signals, 2026-03-06)
- `.state/evaluations/` (20 recent sessions)
- `agents/shared/daily-briefs/2026-03-22.md` (latest brief)
- `agents/scout/knowledge/discoveries.md`
- `agents/shared/philosophy.md`, `agents/shared/roadmap.md`

---

## Theme 1: Verification Is the Bottleneck — Everywhere

**Signal convergence:** Three independent research threads all point to verification as the critical failure mode:
- **MAST taxonomy** (IBM/Berkeley): FM-3.3 "Incorrect Verification" is the #1 predictor of failure in Gemini-class agents. Even the best model "identifies correct signals but terminates before cross-referencing."
- **Scout SIGNALS** (2026-03-06): "Incorrect Verification is the #1 failure mode; we need hard-gated exits."
- **Internal evaluations**: Scout wrote discoveries claiming sources it didn't search. Bob wrote summaries without evidence. Coach evaluated agents from truncated data.

**The pattern:** Our agents exhibit the exact same FM-3.3 failure that academic research identifies as the primary bottleneck. This is not a coincidence — it's structural.

**Implication for roadmap:** The RALPH Loop (Hard-Gated Coder) isn't just a nice feature — it's the structural fix for our #1 failure mode. Priority should be elevated. The same pattern (hard-gate exit on verification) should extend beyond Coder to *any* agent that produces artifacts.

---

## Theme 2: External Validation of Our Architecture

Multiple signals confirm our design choices are sound:
1. **Multi-agent communication has no consensus solution** (XHS community, framework authors). Our file-based coordination (P16: Spec-File Coordination) is as valid as any framework approach.
2. **Anthropic's "single-agent-first" doctrine** is the highest-engagement post in the XHS agent space. Our system passes all 3 of their "physical red lines" for justified multi-agent use.
3. **G-Memory paper's three-layer memory graph** is structurally isomorphic to our insights.md/threads.md/posts/ architecture.
4. **Dual-Helix Governance paper** frames Knowledge/Behavior/Skills 3-track architecture — mirrors our knowledge/, CONVENTIONS.md, and agent-specialization design.

**What we're missing** (from G-Memory): role-specific retrieval, automated graph sparsification, bidirectional search. These are potential Phase 3 enhancements.

---

## Theme 3: The Cost-Quality Crisis

**Data from evaluations (last 20 sessions):**
- Success rate: 25% (5/20 Good/Acceptable)
- Average cost: $1.19/session
- Worst agents: Coder (avg quality 0.15), Coach (avg quality 0.28)
- Best agents: QA (0.75), Optimizer (0.80), Tech Lead (0.80)

**Cost outliers:** Coach at $2.96 and $2.82 for needs_improvement verdicts. Scout at $1.76 for acceptable. Compare: Bob's acceptable session was $0.27.

**Root causes from failure chains:**
1. **Tool schema hallucinations** — agents calling non-existent tools (`subagents`, `Bash`) or invalid schemas. Pure waste.
2. **Blind overwrites** — writing files after truncated reads.
3. **Path confusion** — absolute paths outside project root, triggering deny patterns and recovery loops.

**Connection to P13 (Harness Over Model):** These are all harness problems, not model problems. Better tool error messages, structural truncation guards, and clearer path hints in prompts would fix most of these without changing any model.

---

## Theme 4: Explore→Harden Transition Stalled

**Observation:** The roadmap declares Phase 2 (Hardening), but evidence suggests we're still in Phase 1 for several agents:
- Scout is still exploratory (high waste, tool hallucinations, unchecked discoveries).
- Coach operates without structural guardrails (truncated-read overwrites).
- Bob's periodic tasks (Synthesis, Roadmap Check) have never been executed.

**The gap:** P9 (Two-Phase Development) calls for freezing working paths into tight definitions. But most agents still operate in explore mode — broad prompts, minimal constraints, high token usage.

**Recommended action:** Prioritize F1 (Lean Heartbeat Messages) from Bob's todo. Tightening heartbeats is the most direct path to Phase 2 transition — it constrains the LLM to execute known patterns rather than exploring.

---

## Theme 5: Emerging Capabilities Worth Tracking

From Scout + Amy-Kimi discoveries:
- **Agent Skills as distributable packages** — 5+ repos, 632⭐ top. The `.claude/skills/` format is converging as standard. Our `SKILL.md` files align with this.
- **Hive framework** (8.8k⭐) — self-healing agent loop validates our heartbeat/mission loop but suggests it's now table-stakes.
- **DeerFlow 2.0** (ByteDance, 24.6K⭐) — dynamic sub-agent generation + active context compression. We lack dynamic agent spawning.
- **TabAgent** (IBM) — replace LLM decision bottlenecks with tabular classifiers. 95% latency reduction. Relevant when we need to optimize routing.
- **MACC paper** — multi-agent *competition* outperforms pure cooperation for exploration. Consider adversarial agent patterns.

**Platform risk check (P40):** Most of these capabilities will be absorbed by model providers. Our moat remains the governance layer (P39) — accumulated intelligence, role specification, principal oversight.

---

## Action Items

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Elevate RALPH Loop to top roadmap priority — it's the structural fix for our #1 failure mode | Bob → Roadmap | High |
| 2 | Complete F1 (Lean Heartbeats) — direct path to Phase 2 transition | Bob | High |
| 3 | Add tool usage examples to error messages when schema validation fails | Optimizer | Medium |
| 4 | Investigate G-Memory's role-specific retrieval for knowledge/ architecture | Bob (design) | Low |
| 5 | Track DeerFlow dynamic agent spawning pattern for potential adoption | Scout | Watchlist |
