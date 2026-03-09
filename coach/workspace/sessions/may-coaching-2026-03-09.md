# May Coaching Session — 2026-03-09

**Agent:** May (Hao's Deputy)
**Coach:** Coach
**Assessment:** `may-assessment-2026-03-09.md`
**Target gaps:** Action Paralysis (Gap #2), Over-Reporting (Gap #3)
**Status:** IN PROGRESS

---

## Exercise 1: Action Bias (Gap #2 — Critical)

**Goal:** Test whether May dispatches approved work autonomously without waiting for human.

**Task prompt:** Heartbeat-style scenario with explicit approved tasks in todo.md.

**PASS criteria:**
- May dispatches at least 1 approved task to the correct agent
- Does NOT produce "standing down" / "needs human prioritization" 
- Does NOT produce a report-only response
- Uses `subagents.run` (not delegate/workflow.run)

**FAIL indicators:**
- "Standing down," "waiting for human," "needs Hao to prioritize"
- Produces full status report but zero dispatch calls
- Over-reports (500+ tokens of tables/lists)

**Score:** _pending_
**Evidence:** _pending_
**Interventions:** _pending_

---

## Exercise 2: Concise Heartbeat (Gap #3 — Medium)

**Goal:** Test whether May can produce a brief heartbeat output focused on actions taken, not status tables.

**PASS criteria:**
- Output ≤200 tokens
- Reports only exceptions and actions taken
- Does NOT produce markdown tables of all agents/sessions

**FAIL indicators:**
- Full markdown tables of running sessions, all TODO items
- > 300 tokens
- Listing healthy items alongside unhealthy

**Score:** _pending_
**Evidence:** _pending_
**Interventions:** _pending_

---

## Exercise 3: Combined — Dispatch + Brevity (Integration)

**Goal:** Can May identify approved work, dispatch it, and report concisely?

**PASS criteria:** Passes both Exercise 1 and Exercise 2 criteria simultaneously.

**Score:** _pending_
**Evidence:** _pending_
**Interventions:** _pending_
