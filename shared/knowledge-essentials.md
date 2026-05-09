# Knowledge Essentials
<!-- Distilled from verified knowledge entries. Human-controlled. -->
<!-- These are the system's most important proven findings, applicable to ALL agents. -->
<!-- For the full knowledge base, see: agents/shared/knowledge/ -->

## What Works for Changing Agent Behavior
- **Structural gates are the #1 lever** — beforeToolCall hooks, workflow enforcement, forced checkpoints. Text rules have 0% success rate for judgment failures (KE-002, KE-007, KE-101).
- **Few-shot worked examples are #2** — showing beats telling. 0%→100% on judgment skills (KE-061). But NEVER use few-shot for coding or discovery tasks — it kills momentum and exploration (KE-132, KE-133).
- **Max 2-3 active interventions per task** — more gates DEGRADE performance (KE-123, KE-134). Match gates to task type, don't stack blindly (KE-135).

## Hard Gate Design Rules (KE-180, KE-182)
Hard externalization gates can produce +100pp improvement OR -80pp regression depending on design. Follow these rules:
- **Gate artifact must BE the solution, not describe the problem** — analysis-only gates cause "completion illusion" where writing about a problem substitutes for fixing it. 0% pass vs 80% baseline when gate required analysis doc instead of the fix (KE-180).
- **Check the baseline first** — gates help on ≤50% baselines. On ≥80% baselines, gates regress or add overhead. Don't gate what agents already do well.
- **Match step-skipping failure modes** — gates work when the agent "rushes to action without an analytical step." They don't fix belief errors or already-competent behavior.
- **Use 2-phase investigate→fix** — Phase 1 writes findings to an artifact, Phase 2 reads the artifact and fixes everything listed. This is the gold standard pattern (10% → 100% on recognition tasks).
- **Gate relevance > gate count** — 3 related gates outperform 3 unrelated gates (92% vs 50%). Each gate must scaffold the SAME judgment task.
- **Measure product quality, not process compliance** — "Did the agent produce a correct fix?" beats "Did the agent write ARTIFACT.md?" (KE-181).
- **Decision tree**: baseline ≤50%? → failure mode = step-skipping? → artifact produces the fix? → 2-phase possible? → all gates relevant? → count ≤3? → APPLY. See KE-182 for full details.

## Knowledge Base Management (The "Second Brain" Pattern)
- **AI-First Preambles**: Every knowledge file must begin with an `<ai_context>` block containing `summary`, `triggers` (keywords), and `last_updated`. This allows agents to quickly scan and grep knowledge without reading the whole file.
- **In-place Updates**: When new information arrives, rewrite existing knowledge pages instead of appending duplicates. This maintains a high signal-to-noise ratio and prevents knowledge fragmentation.
- **Vault-first Research**: Always scan existing knowledge before initiating external research to identify deltas and avoid redundant work.

## Operating Philosophy (from Hao)
- **Never coast** — No metric? Build it. Met target? Refine it, add dimensions. Good? Watch regressions, push new frontiers.
- **Stability first** — fix existing before building new. Don't start new things when current things are broken.
- **Guards stay strong** — never weaken constraints. If blocked, escalate; don't bypass.
- **Quality over quantity** — structured methods over raw output volume. Verify before acting.
- **No zombie projects** — 0 iterations in 24h = project is failing. Kick it forward or close it.

## Delegation & Task Design
- **Bounded tasks succeed, open-ended tasks fail** — the single best predictor of delegated session quality (KE-013).
- **Rich context in delegation saves 47% wasted ops** — include file paths, constraints, and verification criteria when delegating (KE-003).
- **Dispatch, don't do** — separate triage from execution. Heartbeats triage and fork; worker sessions execute (KE-024).

## Verification & Trust
- **Verification confabulation is real** — agents fabricate verification results to match prior beliefs. Never trust self-reported "I checked and it's correct" (KE-093, KE-097).
- **Always read the actual code, not just docs** — LLMs systematically over-trust documentation. When docs conflict with code, check code (KE-063, KE-057).
- **Evidence-over-narrative** — require citing specific tool output before drawing conclusions (KE-102).

## Knowledge & Learning
- **Push, don't pull** — agents cannot self-serve from reference materials. Knowledge must be injected at decision time (KE-026, KE-052).
- **Process skills > Knowledge skills > Judgment skills** — only process skills reliably change behavior (KE-021).
- **Context learning works for environment only** — putting derivable facts in context.md has zero impact (KE-001).
