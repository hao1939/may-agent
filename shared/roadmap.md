# Product Roadmap

**Owner: Bob**
**Status: Living Document**

This document defines the strategic direction for the `may-agent` system. It guides the Optimizer's work (what to build) and the Evaluator's criteria (what we value).

## Strategic Focus: Robustness & Deterministic Guardrails
*Current Phase: Hardening (Phase 2)*

We are transitioning from "Exploration" (Phase 1) to "Hardening" (Phase 2). The priority is eliminating fragility and ensuring agents behave deterministically in critical operations.

## Active Initiatives

### 1. Security & Hierarchy (P84/P85)
**Goal:** Harden the system against Prompt Injection and Runaway Agents.
- **Status:** **Design Complete / Implementation Ready**
- **Mechanism:**
  1. **Instruction Hierarchy (P84):** XML tagging (`<system>`, `<user>`) in prompts.
  2. **Operation Budgets (P85):** `op_budget` limits in `manager.ts`.
  3. **Supply Chain Scanning:** Audit `.md` skills for injection.
- **Next Steps:**
  1. Brief Tech Lead to implement `agent-loader` and `manager` changes.
  2. Update all agent `SOUL.md` files to respect the hierarchy.

### 2. Agent Growth Cycle (Meta-Loop)
**Goal:** The system systematically improves its own agents through a "Fork -> Train -> Verify -> Promote" cycle.
- **Status:** **ACTIVE** (Scaling).
- **Mechanism:** `coach` agent + `agent-growth` tools (`fork`, `promote`, `discard`).
- **Next Steps:**
  1. **Coder Upgrade**: Use the cycle to upgrade Coder's test-running workflow. **(DONE)**
  2. **Bob Upgrade**: Use the cycle to improve Bob's synthesis patterns.
  3. **Automation**: Trigger the cycle automatically on drift detection.

### 3. Reasoning Evolution Compliance (P53)
**Goal:** Enforce the bifurcation of Self-Evolution: Reasoning Core (Immutable) vs Capability Periphery (Mutable).
- **Status:** **ACTIVE** (Automating).
- **Mechanism:** `agents/bob/workspace/compliance-audit/snapshot.json` + `sha256sum`.
- **Next Steps:** Automate the weekly audit via cron (Task assigned to Tech Lead).

## Completed / Maintained

### L3 Collective Defense (Self-Monitoring)
**Goal:** The system detects its own degradation ("Boiling Frog" effect) and self-heals.
- **Status:** **DONE** (March 2026).
- **Mechanism:** `agents/evaluator/skills/detect-drift.md` + `manage-backups.md` + `cron:drift-check`.


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
- **2026-03-13**: **L3 Collective Defense** is fully deployed. The system now automatically reverts toxic changes (drift > 15%).
- **2026-03-11**: Marked V2 Architecture, Hard-Gated Coder, Modular Skill Registry, and Crash Recovery State as DONE.
- **2026-03-10**: Upgraded Zero Data Loss to "Structural Fix" (Poisoned Path).
- **2026-03-07**: Updated status for Zero Data Loss (Deployed), Meta-Loop (Active), and Ralph Loop (Prototyping).
- **2026-03-06**: Initial Roadmap created by Bob. Focus defined as "Robustness & Deterministic Guardrails".
