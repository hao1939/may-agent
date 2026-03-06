# Product Roadmap

**Owner: Bob**
**Status: Living Document**

This document defines the strategic direction for the `may-agent` system. It guides the Optimizer's work (what to build) and the Evaluator's criteria (what we value).

## Strategic Focus: Robustness & Deterministic Guardrails
*Current Phase: Hardening (Phase 2)*

We are transitioning from "Exploration" (Phase 1) to "Hardening" (Phase 2). The priority is eliminating fragility and ensuring agents behave deterministically in critical operations.

## Active Initiatives

### 1. Zero Data Loss (Blind Overwrite Prevention)
**Goal:** Eliminate "truncated read → blind overwrite" failures entirely.
- **Status:** In Progress.
- **Mechanism:** Structural "Shrink Guard" in `write` tool; strictly enforced "Read-Range" protocols in `lessons.md`.
- **Success Metric:** 0 incidents of `lessons.md` or `todo.md` corruption in 7 days.

### 2. Meta-Loop Autonomy
**Goal:** The system self-diagnoses and self-repairs without human initiation.
- **Status:** Active.
- **Mechanism:** Bob (Analyze) → Optimizer (Fix) → Evaluator (Measure) loop.
- **Success Metric:** Optimizer successfully implements a fix that survives 3 subsequent sessions without regression.

### 3. Deterministic Operations
**Goal:** Move repetitive, high-risk logic out of the LLM and into raw code.
- **Status:** Started.
- **Items:**
    - `drain-todo`: Moved to JS loop.
    - `lesson-consolidation`: Moved to strict protocol (considering JS port).
- **Principle:** "If it happens every time, it should be code, not a prompt."

## Feature Backlog

### High Priority
- **Hard-Gated Coder (RALPH Loop)**: A Coder workflow that *structurally disables* the `finish` tool until a verification command (test/lint) returns exit code 0.
- **Modular Skill Registry**: Refactor giant system prompts into small `SKILL.md` files that are lazy-loaded only when needed (Progressive Disclosure pattern).

### Medium Priority
- **Agent-Specific Evaluation**: Custom scorecards for each agent (e.g., Coder = correctness/tests; Bob = insight/alignment) instead of generic "Quality".
- **Crash Recovery State**: `[STARTED]` state tracking to auto-resume orphaned sessions after a process restart.

## Parked / Watchlist
- **Scout/Amy Cross-Synthesis**: synthesizing external market signals. (Parked until core system stability is >95%).
- **Vector Memory**: (Parked; file-based navigation is sufficient for current scale).

## Change Log
- **2026-03-06**: Initial Roadmap created by Bob. Focus defined as "Robustness & Deterministic Guardrails".
