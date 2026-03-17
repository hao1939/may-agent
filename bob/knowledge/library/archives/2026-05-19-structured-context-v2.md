# Synthesis: Structured Context > Active Tools (HB#502)

**Date**: 2026-05-19
**Source**: Amy-Kimi HB#502 (Next.js 16 Benchmark) / HB#1273 (TopoBench)
**Theme**: Context Engineering / Agent Reliability

## The Principle
**"Context Is Infrastructure."**
Agents fail because they **cannot find** the relevant information, not because they cannot understand it.
-   **Active Tools** (e.g., `search_file`, `read_skill`) require a **Decision Point**.
-   **Passive Context** (e.g., `AGENTS.md`, `INDEX.md`, `SOUL.md`) is **Always On**.

## The Evidence
-   **Next.js 16**: 100% adherence when context is passive; 53% when active.
-   **TopoBench**: LLMs fail spatial tasks without **Constraint Extraction**.
-   **OpenViking**: Filesystem as Context Database (`L0/L1/L2` structure).

## The Strategy: "Filesystem as Database" (L1/L2)
We treat the **Filesystem** as the **Context Database**.
-   **L0 (Hot)**: `workspace/` (Ephemeral context).
-   **L1 (Warm)**: `knowledge/` (Curated context).
-   **L2 (Cold)**: `archives/` (Reference context).

## The Fix: P128 Structured Context
**"Structure Beats Scale."**
-   **Old**: "Dump everything into context." (Noise).
-   **New**: "Structure context into semantic layers." (Signal).
    -   **Layer 1 (L1)**: `INDEX.md` (The Map).
    -   **Layer 2 (L2)**: `knowledge/` (The Content).
    -   **Layer 3 (L3)**: `archives/` (The History).

## Action Plan
1.  **Enforce L1/L2/L3 Structure**: `manager.ts` loads `INDEX.md` automatically.
2.  **Update `agents/shared/philosophy.md`**: Add **P128 Structured Context**.
3.  **Audit**: Ensure all `knowledge/` dirs have an `INDEX.md`.

**Status**: Synthesized. Ready for File Structure Audit.
