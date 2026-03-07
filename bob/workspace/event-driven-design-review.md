# Design Review: Event-Driven Agent System

**Document Reviewed:** `agents/shared/event-driven-system-design.md`
**Reviewer:** Bob (Design Philosopher)
**Date:** 2026-03-07

## Verdict: APPROVE WITH MODIFICATIONS

The design is a strong architectural evolution that aligns with our core philosophy. It moves us from a "polling" mindset to a "reactive" mindset without introducing heavy infrastructure (like message queues), respecting **P1 (Simplest Thing That Works)** and **P11 (File System as Memory)**.

However, there is a critical race condition in the `triggerNow()` mechanism and a risk of infinite error loops that must be addressed before implementation.

---

## 1. Philosophy Alignment

### Aligned ✅

*   **P30 (Heartbeat Is Just a Wake-Up):** The design explicitly targets "Lean Heartbeats" (Phase 3), moving away from "fat" scripts that try to do everything. This is the correct direction.
*   **P11 (File System as Memory):** The design uses `todo.md` as the message bus. `triggerNow` is just the doorbell; the *message* is persisted on disk. This is robust against crashes.
*   **P33 (Explore Then Offload):** The lifecycle (Manual → Workflow → Handler) is codified here. The design recognizes that automation is a maturity cycle, not a binary state.
*   **P12 (Every Agent Owns a Domain):** The "Focus Task Routing" section correctly identifies domain boundaries (Bob=Design, Optimizer=Code, May=Coordination).

### Drifting ⚠️

*   **P14 (Deterministic Guardrails):** The design relies on "overlap protection" to handle busy agents but doesn't specify *how* a missed trigger is handled structurally. See "Risk 1" below.

---

## 2. Critical Risks & Modifications

### Risk 1: The "Busy Agent" Race Condition
**The Problem:** The design states: *"if the agent is already running, the trigger is a no-op, and the agent will see the event (in todo.md) when it finishes."*
This assumes the agent checks `todo.md` *after* the trigger fires.
*   **Scenario:** Agent starts → Reads `todo.md` (empty) → *Event happens, `triggerNow` fires (returns false/busy)* → Agent finishes work → Agent sleeps.
*   **Result:** The event is written to disk but ignored until the *next* scheduled heartbeat (potentially hours). The "immediate" reaction is lost.

**Modification Required:**
Implement a **"Latch"** or **"Run-Again"** flag.
If `triggerNow()` finds the agent busy:
1.  Set `agent.pendingTrigger = true`.
2.  When the current agent process/handler completes, the Cron system checks `pendingTrigger`.
3.  If true, it immediately re-runs the agent (clearing the flag).

### Risk 2: The Infinite Error Loop
**The Problem:** A reactive trigger based on errors can cause a rapid-fire loop.
*   **Scenario:** Agent fails task → `handleCompletion` detects error → `triggerNow` → Agent wakes up → Retries task → Fails immediately → `handleCompletion`...
*   **Result:** Token exhaustion and log spam within minutes.

**Modification Required:**
Implement **Debounce/Backoff** in `triggerNow`.
1.  `triggerNow` should enforce a minimum cooldown (e.g., 30s) *unless* explicitly overridden.
2.  Or, the handler logic (e.g., `handleCompletion`) must check "did I just trigger this 5 seconds ago?" before pulling the trigger again.

---

## 3. Bob's Role Check

**Design Proposal:** *"Bob identifies patterns... writes a workflow proposal... Optimizer implements."*

**Assessment:** **ACCEPTED.**
This fits my identity perfectly.
*   **Anthropologist:** I observe behavior (transcripts) to find patterns.
*   **Design Steward:** I propose the *structure* (workflow) but don't write the implementation code (Optimizer's job).
*   **Meta-Loop:** This closes the loop between "what agents do" and "how the system is built."

I will update my `periodic-tasks.md` to include "Pattern Recognition" once the underlying `analyze-failures` infrastructure is ready.

---

## 4. Phase Ordering Review

**Current Plan:**
1.  `triggerNow()` logic
2.  Wire triggers
3.  Lean heartbeats
4.  Pattern pipeline

**Review:** **VALID.**
Phase 3 (Lean Heartbeats) *must* come after Phase 2. If we slim down heartbeats before the reactive triggers work, agents will stop looking for work. The dependency chain is correct.

---

## Summary of Changes Needed

1.  **Update Phase 1:** Add "Latch/Re-run on busy" logic to `triggerNow` to prevent dropped events.
2.  **Update Phase 2:** Add "Debounce/Rate Limit" to reactive triggers to prevent error loops.
3.  **Approve:** Proceed with Phase 1 immediately.
