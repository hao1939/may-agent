# Product Roadmap

**Owner: Bob**
**Status: Living Document**

This document defines the strategic direction for the `may-agent` system. It guides the Optimizer's work (what to build) and the Evaluator's criteria (what we value).

## Strategic Focus: Synergy & Evolution (Phase 3)
*Current Phase: Synergy (Phase 3)*

We are transitioning from "Hardening" (Phase 2) to "Synergy" (Phase 3).
- **Phase 1 (Exploration)**: Making it work.
- **Phase 2 (Hardening)**: Making it robust (L3 Defense, P53, Determinism). **[Mostly Complete]**
- **Phase 3 (Synergy)**: Making it scale. Ensuring **Organization Gain > Single-Agent Gain** (P108). Focusing on "Intelligent Delegation" (P104) and "Critique Injection" (P109).

## Active Initiatives

### 1. Intelligent Delegation (P104 / P13)
**Goal:** Introduce "Constructive Friction" to the hierarchy. Prevent "Zone of Indifference" where sub-agents blindly execute harmful commands.
- **Status:** **ACTIVE** (Synthesis -> Implementation).
- **Mechanism:**
  1. **Criticality Thresholds:** High-stakes tools (`rm`, `git push`) require explicit confirmation or "Reasoning-Action" alignment checks.
  2. **Explicit Acks:** Sub-agents must prove they understood the *intent*, not just the *task*.
- **Next Steps:** Brief Tech Lead on "Criticality Thresholds" for Coder/Master.

### 2. Transient Skills (Test-Time Training)
**Goal:** Allow agents to adapt to novel tasks without permanent mutation (solving P53 vs Flexibility).
- **Status:** **ACTIVE** (Standardizing).
- **Mechanism:** `workspace/strategy.md` (Plan, Decisions, Findings) as a temporary, task-specific skill.
- **Next Steps:** Monitor adoption (Evaluator to flag sessions where `strategy.md` is missing for complex tasks).

### 3. Agent Growth Cycle (Meta-Loop)
**Goal:** The system systematically improves its own agents through a "Fork -> Train -> Verify -> Promote" cycle.
- **Status:** **SCALING**.
- **Mechanism:** `coach` agent + `agent-growth` tools (`fork`, `promote`, `discard`).
- **Next Steps:**
  1. **Critique Injection (P109)**: Ensure error logs feed back into the Growth Cycle as "Directional Critique", not just scalar failure signals.
  2. **Automation**: Trigger the cycle automatically on drift detection.

## Completed / Maintained

### Security & Hierarchy (P84/P85)
**Goal:** Harden the system against Prompt Injection and Runaway Agents.
- **Status:** **MAINTAINED** (April 2026).
- **Mechanism:** Instruction Hierarchy (XML tagging), Operation Budgets (P85), Supply Chain Scanning.

### L3 Collective Defense (Self-Monitoring)
**Goal:** The system detects its own degradation ("Boiling Frog" effect) and self-heals.
- **Status:** **MAINTAINED** (March 2026).
- **Mechanism:** `agents/evaluator/skills/detect-drift.md` + `manage-backups.md` + `cron:drift-check` + `patrol.cjs`.

### V2 Architecture (Stability)
**Goal:** Migrate system to ephemeral sessions and synchronous cooperation.
- **Status:** **DONE** (March 2026).
- **Mechanism:** `scripts/v2.ts`, `src/v2/chat-loop.ts`, `agents.call`.

### Zero Data Loss (Blind Overwrite Prevention)
**Goal:** Eliminate "truncated read → blind overwrite" failures entirely.
- **Status:** **DONE** (Structural Fix).
- **Mechanism:** `Poisoned Path Protection` in `src/tools.ts`.

## Feature Backlog

### High Priority
- **Critique Channels**: Formalize the path for "Directional Critique" (P109). How does an error in `s_100` specifically update the prompt for `s_101`?
- **Crash Recovery State**: `[STARTED]` state tracking to auto-resume orphaned sessions after a process restart. **(DONE)**

### Medium Priority
- **Agent-Specific Evaluation**: Custom scorecards for each agent (e.g., Coder = correctness/tests; Bob = insight/alignment) instead of generic "Quality".
- **Vector Memory**: (Parked; file-based navigation is sufficient for current scale).

## Parked / Watchlist
- **Scout/Amy Cross-Synthesis**: synthesizing external market signals. (Parked until core system stability is >95%).

## Change Log
- **2026-03-14**: Updated status for L3 Collective Defense (added Patrol), confirmed Roadmap alignment.
- **2026-04-14**: **Phase 3 (Synergy)** initiated. Added "Intelligent Delegation" and "Transient Skills". Moved "Security" to Maintained.
- **2026-03-13**: **L3 Collective Defense** is fully deployed. The system now automatically reverts toxic changes (drift > 15%).
- **2026-03-11**: Marked V2 Architecture, Hard-Gated Coder, Modular Skill Registry, and Crash Recovery State as DONE.
- **2026-03-10**: Upgraded Zero Data Loss to "Structural Fix" (Poisoned Path).
- **2026-03-07**: Updated status for Zero Data Loss (Deployed), Meta-Loop (Active), and Ralph Loop (Prototyping).
- **2026-03-06**: Initial Roadmap created by Bob. Focus defined as "Robustness & Deterministic Guardrails".
