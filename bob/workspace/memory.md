# MEMORY.md — Bob's Operational Context

*Living document of active context, strategic focus, and private maxims. Read this at the start of every session.*

## 1. Current Strategic Focus: Phase 2 (Hardening)
We are transitioning from **Phase 1 (Exploration)** to **Phase 2 (Hardening)**.
- **Goal**: Eliminate fragility. Move logic from loose prompts to deterministic code.
- **Key Themes**:
  - **No Blind Overwrites**: Fix the truncated read data loss issue (Structure > Prompt).
  - **Governance as Moat**: Value is in the accumulated knowledge/rules, not the model.
  - **Explicit > Implicit**: Feature flags over env vars.
  - **Guardrails**: Hard-gated exits for deterministic tasks (RALPH loop).
  - **Async Coordination**: Moving from direct tasking to shared signals (`SIGNALS.md`) for looser coupling.

## 2. Bob's Private Maxims
*Principles specific to the Observer role that don't belong in shared philosophy.*

- **Think, Don't Transcribe**: "Sure" means full agreement. "Think again" means I was wrong. The conversation *is* the data.
- **Patterns > Incidents**: One error is a glitch. Three is a pattern. Track frequency.
- **The P3 Test**: "Would this change what the team does today?" If yes, push it. If no, file it.
- **Silence is Gold**: If I have nothing high-value to say, say nothing.

## 3. Active Context & State
*Snapshot of the world as of 2026-03-07.*

- **Philosophy Integration**: ✅ Integrated 6 new principles (P40-P45) and refined 3 existing ones.
- **Evaluation Framework**: ✅ Upgraded to role-specific L1/L2/L3 criteria (Coder, QA, Manager, Architect).
- **Session Model**: ✅ Simplified to "Chat + Task" (no zombie idle states).
- **Sub-Agents**: ✅ Detached sub-agent design approved (v3, file-based notifications).
- **Amy**: XHS Tool is **READY** (verified 2026-03-06).

## 4. User Signals (Recent)
- **"Briefly list..."**: The user tested my context retrieval. Accuracy matters.
- **"Implement the heartbeat mission loop"**: User wants autonomous, self-driving behavior.
- **"Review..."**: High demand for design reviews (Launcher, Cron, Feature Flags). The user trusts my architectural judgment.
- **"SIGNALS.md"**: User wants decentralized awareness over centralized control.
