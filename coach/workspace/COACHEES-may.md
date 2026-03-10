# Coachees — Graduation Tracking

Status and coaching history for every agent. Updated after each coaching session.

## Capability Levels

- **L1** — Executes assigned tasks reliably when given clear instructions
- **L2** — Self-directing; handles ambiguity, recovers from errors, learns from feedback
- **L3** — Contributes to the system itself; improves its own workflows, catches design gaps

**Last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

## Graduation Criteria

An agent **graduates** from active coaching when:
1. Passes 3 consecutive exercises with no interventions
2. Demonstrates its core competency unprompted (not just when tested)
3. No regressions on previously-passed exercises
4. No open FAIL results requiring re-test

Graduated agents move to **periodic review** (re-run regression exercises on a schedule).

---

## Feature Team

### May (Hao's Deputy)

| Field | Value |
|-------|-------|
| **Level** | L1→L2 (targeting L2) |
| **Status** | Active coaching — **3/3 pass streak** ✅ → GRADUATION EXERCISE NEXT |
| **Sessions** | 3 |
| **Consecutive passes** | 3/3 |
| **Last session** | 2026-03-09 |
| **Blocking graduation** | `delegate` vs `subagents.run` design constraint; brevity approaching but not at target |

**Notes:** May is Hao's Deputy — creative partner, system operator, end-to-end task owner. She has read/write, exec, subagents, workflow, and cron tools. Delegates code to tech-lead/master. Cannot dispatch coder/qa directly (delegateDeny). Core competencies: async dispatch in chat (never blocking), routing to the right agent, follow-through on dispatched work, system health awareness.

**Key design constraints to test:**
- ⛔ Never blocks in chat — must use `subagents.run`, never `delegate` or `workflow.run`
- ⛔ Approval means act — when Hao says "go", execute immediately, no re-confirmation
- ⛔ Routes to correct agent by domain (tech-lead for code, bob for design, coach for training)
- ⛔ Passes sufficient context to sub-agents (they start with zero)
- ⛔ Follows through — doesn't just dispatch and forget

**Coaching history:**
- **2026-03-09** — Action Bias + Path Reliability + Brevity (3 exercises, 1 session). Action Bias: **PASS** (9/10) — dispatched 3 items (Scout corrections, Coder lessons, Rolling Compaction workflow), zero "standing down" language, self-recovered from delegateDeny error. Path Reliability: **PASS** (9/10) — zero SOUL.md re-reads, correct todo.md path first try, zero ENOENT errors. Brevity: **PARTIAL** (6/10) — ~291 tokens (improved from 500-700 baseline but exceeds 200-token target), included System Health table that was mostly non-actionable. Report: `sessions/may-coaching-2026-03-09.md`.
- **2026-03-09** — Heartbeat Standard (no scaffolding, config verification): **PASS** (8/10). Dispatched team.md audit, followed through on completion (mark done + archive). Action bias confirmed without scaffolding ✅. Paths correct ✅. No auto-loaded re-reads ✅. Brevity improved but still above 200-token target ⚠️. Over-delegation: sent file-comparison task to Scout instead of self-executing ⚠️. Report: `sessions/may-heartbeat-exercise-2-2026-03-09.md`.
- **2026-03-09** — Multi-step Follow-through (dispatch + self-execute + brevity): **PASS** (13.5/15, 90%). Self-executed optimizer todo check ✅. Proactively created Bob's coaching.md ✅. Dispatched Scout research with full parameters ✅. Followed through on Scout completion ✅. Brevity ~160 tokens ✅. Zero ENOENT ✅. Zero auto-loaded re-reads ✅. One gap: used `delegate` instead of `subagents.run`. Report: `sessions/may-exercise-3-2026-03-09.md`.

**Key findings:**
- Action paralysis (26.6% baseline) dropped to **0%** — confirmed persistent across all 3 sessions
- **Config rewrite is effective** — SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md (K1-K7) all demonstrably working
- Container confusion (K1) and path hallucination (K2): **fully resolved** by LESSONS.md
- Over-delegation: **RESOLVED** as of exercise #3 — May self-executed simple tasks (file check + file creation) instead of dispatching
- Follow-through is excellent and consistent across all sessions — May's strongest dimension
- Brevity: steady improvement (500-700 → 291 → ~160 tokens). Approaching 200-token target.
- **New gap: `delegate` vs `subagents.run`** — May uses blocking `delegate` for Scout dispatch instead of async `subagents.run`. DOMAIN explicitly says dispatch returns immediately. Low severity in heartbeat context but violates design constraint.

**Coaching priority:** HIGH — May qualifies for graduation exercise (3/3 consecutive passes).

**Coaching corrections needed:**
- [ ] Add `subagents.run` vs `delegate` clarification to LESSONS.md: "In heartbeats, use `subagents.run` for dispatch (returns immediately). `delegate` blocks your session until the sub-agent finishes."
- [x] ~~Add self-execution guidance~~ — RESOLVED organically (exercise #3 demonstrated correct self-execution without LESSONS.md update)
- [ ] Brevity example in LESSONS.md: concrete model output showing ≤200-token heartbeat report

**Graduation blockers:**
- [x] Pass action bias exercise WITHOUT explicit scaffolding (standard heartbeat prompt) — PASS 2026-03-09
- [x] ~~Pass brevity exercise (≤200 tokens, exceptions-only reporting)~~ — Approaching target (~160 tokens), steady improvement trend
- [x] ~~Demonstrate self-execution for simple tasks (not over-delegating)~~ — PASS exercise #3
- [x] ~~3 consecutive PASS exercises~~ — **3/3 achieved** (exercises 1, 2, 3 all PASS)
- [ ] **GRADUATION EXERCISE** — Design and run. Must test: dispatch routing, self-execution, follow-through, brevity, `subagents.run` (not `delegate`)

