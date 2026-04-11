# Knowledge Essentials
<!-- Distilled from verified knowledge entries. Human-controlled. -->
<!-- These are the system's most important proven findings, applicable to ALL agents. -->
<!-- For the full knowledge base, see: agents/shared/knowledge/ -->

## What Works for Changing Agent Behavior
- **Structural gates are the #1 lever** — beforeToolCall hooks, workflow enforcement, forced checkpoints. Text rules have 0% success rate for judgment failures (KE-002, KE-007, KE-101).
- **Few-shot worked examples are #2** — showing beats telling. 0%→100% on judgment skills (KE-061). But NEVER use few-shot for coding or discovery tasks — it kills momentum and exploration (KE-132, KE-133).
- **Max 2-3 active interventions per task** — more gates DEGRADE performance (KE-123, KE-134). Match gates to task type, don't stack blindly (KE-135).

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
