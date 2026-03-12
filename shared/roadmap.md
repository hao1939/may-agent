# Product Roadmap

**Owner: Bob**
**Status: Living Document**

This document defines the strategic direction for the `may-agent` system. It guides the Optimizer's work (what to build) and the Evaluator's criteria (what we value).

## Strategic Focus: Robustness & Deterministic Guardrails
*Current Phase: Hardening (Phase 2)*

We are transitioning from "Exploration" (Phase 1) to "Hardening" (Phase 2). The priority is eliminating fragility and ensuring agents behave deterministically in critical operations.

## Active Initiatives

### 1. Agent Growth Cycle (Meta-Loop)
**Goal:** The system systematically improves its own agents through a "Fork -> Train -> Verify -> Promote" cycle.
- **Status:** **VALIDATED** (Scout V2).
- **Mechanism:** `coach` agent + `agent-growth` tools (`fork`, `promote`, `discard`).
- **Next Steps:** Apply to other agents (Coder, Bob). Automate the trigger (drift detection -> auto-upgrade).

### 2. V2 Hardening & Observability
**Goal:** Stabilize the new ephemeral session architecture and ensure deep visibility into agent behavior.
- **Status:** Active.
- **Mechanism:** `may.sh` improvements, structured logging, session recovery.
- **Success Metric:** < 1% crash rate on long-running tasks.

## Completed / Maintained

### V2 Architecture (Stability)
**Goal:** Migrate system to ephemeral sessions and synchronous cooperation.
- **Status:** **DONE** (March 2026).
- **Mechanism:** `scripts/v2.ts`, `src/v2/chat-loop.ts`, `agents.call`.

### Zero Data Loss (Blind Overwrite Prevention)
**Goal:** Eliminate "truncated read → blind overwrite" failures entirely.
- **Status:** **DONE** (Structural Fix).
- **Mechanism:** `Poisoned Path Protection` in `src/tools.ts`.

### Hard-Gated Coder (RALPH Loop)
**Goal:** A Coder workflow that *structurally disables* the `finish` tool until a verification command (test/lint) returns exit code 0.
- **Status:** **DONE** (March 2026).
- **Mechanism:** `verified-coder` workflow.

## Feature Backlog

### High Priority
- **Modular Skill Registry**: Refactor giant system prompts into small `SKILL.md` files that are lazy-loaded only when needed (Progressive Disclosure pattern). **(DONE)**
- **Crash Recovery State**: `[STARTED]` state tracking to auto-resume orphaned sessions after a process restart. **(DONE)**

### Medium Priority
- **Agent-Specific Evaluation**: Custom scorecards for each agent (e.g., Coder = correctness/tests; Bob = insight/alignment) instead of generic "Quality". (Partially done with L1/L2/L3 criteria).
- **Deterministic Operations**: Move repetitive, high-risk logic out of the LLM and into raw code (e.g., `drain-todo` loop).

## Parked / Watchlist
- **Scout/Amy Cross-Synthesis**: synthesizing external market signals. (Parked until core system stability is >95%).
- **Vector Memory**: (Parked; file-based navigation is sufficient for current scale).

## Change Log
- **2026-03-11**: Marked V2 Architecture, Hard-Gated Coder, Modular Skill Registry, and Crash Recovery State as DONE.
- **2026-03-10**: Upgraded Zero Data Loss to "Structural Fix" (Poisoned Path).
- **2026-03-07**: Updated status for Zero Data Loss (Deployed), Meta-Loop (Active), and Ralph Loop (Prototyping).
- **2026-03-06**: Initial Roadmap created by Bob. Focus defined as "Robustness & Deterministic Guardrails".
