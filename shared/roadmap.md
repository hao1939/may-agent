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
- **Status:** Deployed (Workflow Available).
- **Mechanism:** `safe-edit` workflow (uses `grep` + `sed` instead of read-write).
- **Adoption:** Workflow exists (`agents/optimizer/workflows/safe-edit.ts`). Next: Roll out to Coder/Optimizer domain instructions.
- **Success Metric:** 0 incidents of `lessons.md` or `todo.md` corruption in 7 days.

### 2. Meta-Loop Autonomy
**Goal:** The system self-diagnoses and self-repairs without human initiation.
- **Status:** Active (Daily Cycle Established).
- **Mechanism:**
    - **Detection:** Pattern Recognition Pipeline (F2) scans for recurring issues.
    - **Reporting:** Daily Brief (F5) summarizes health for human.
    - **Fixing:** Ralph Loop (F4) drives discoveries to implementation.
- **Success Metric:** Optimizer successfully implements a fix that survives 3 subsequent sessions without regression.

### 3. Hard-Gated Coder (RALPH Loop)
**Goal:** A Coder workflow that *structurally disables* the `finish` tool until a verification command (test/lint) returns exit code 0.
- **Status:** Prototyping (Experiment 1 Complete).
- **Progress:** `vet-skill` workflow successfully used the loop.
- **Next:** Apply this pattern to general coding tasks.

## Feature Backlog

### High Priority
- **Modular Skill Registry**: Refactor giant system prompts into small `SKILL.md` files that are lazy-loaded only when needed (Progressive Disclosure pattern).
- **Crash Recovery State**: `[STARTED]` state tracking to auto-resume orphaned sessions after a process restart.

### Medium Priority
- **Agent-Specific Evaluation**: Custom scorecards for each agent (e.g., Coder = correctness/tests; Bob = insight/alignment) instead of generic "Quality". (Partially done with L1/L2/L3 criteria).
- **Deterministic Operations**: Move repetitive, high-risk logic out of the LLM and into raw code (e.g., `drain-todo` loop).

## Parked / Watchlist
- **Scout/Amy Cross-Synthesis**: synthesizing external market signals. (Parked until core system stability is >95%).
- **Vector Memory**: (Parked; file-based navigation is sufficient for current scale).

## Change Log
- **2026-03-07**: Updated status for Zero Data Loss (Deployed), Meta-Loop (Active), and Ralph Loop (Prototyping).
- **2026-03-06**: Initial Roadmap created by Bob. Focus defined as "Robustness & Deterministic Guardrails".
