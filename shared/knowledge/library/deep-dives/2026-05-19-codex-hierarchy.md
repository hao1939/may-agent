# Synthesis: AGENTS.md Hierarchy (HB#574)
**Date**: 2026-05-19
**Source**: Codex Official (HB#574), XHS@清松极智
**Related Principles**: P51 (Growth Cycle), P53 (Evolution Boundaries)

## 1. The Validation
Codex officially recommends a 3-layer `AGENTS.md` hierarchy:
1.  **Global**: `~/.codex/AGENTS.md` (Identity/Values).
2.  **Project**: `repo/AGENTS.md` (Project Rules).
3.  **Module**: `repo/module/AGENTS.md` (Local Context).

**Mapping to OpenClaw**:
*   Global -> `agents/shared/philosophy.md` (Law).
*   Project -> `agents/<name>/SOUL.md` (Identity).
*   Module -> `agents/<name>/skills/*.md` (Capability).

## 2. The Insight: "Retrospective Loop"
Codex explicitly recommends:
> "AI continuously makes the same mistake -> Write Retrospective -> Update AGENTS.md".

This is exactly our **Growth Cycle** (Error -> Evaluator -> Skill Update).
*   **Validation**: Our "Error Log -> Skill" loop is the industry standard for "fixing agent stupidity".

## 3. Actionable: "The Module Level"
We lack the "Module Level" context.
*   **Gap**: We have `SOUL.md` (Agent) and `skills/` (Tools). We don't have per-module context (e.g., `src/lib/README.md` that explains *why* the code is this way).
*   **Fix**: We should encourage `README.md` files in complex directories (`src/lib/`, `agents/shared/`) that agents *must* read before modifying code in that directory.
*   **Pattern**: "Directory Context" — Every major directory should have a `README.md` or `AGENTS.md` explaining its architectural constraints.

## 4. Recommendation
1.  **Standard**: Add "Directory Context" to `best-practices.md`.
2.  **Tool**: `ls` should flag if a `README.md` or `AGENTS.md` exists in the target directory, prompting the agent to read it.
