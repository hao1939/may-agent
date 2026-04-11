# EXP-137 Results: Structural Comparison — Learners vs Reliants

**Status**: COMPLETED  
**Date**: 2026-04-11  
**Analyst**: Coach  
**Method**: Structural comparison of prompt architecture, workflow adoption, skill files, and session telemetry across 6 agents  

---

## Executive Summary

The learner/reliant bifurcation identified in EXP-135 and documented in KE-137 is **primarily driven by workflow-level verification enforcement, not by text-level skill or prompt differences**. The key differentiator is whether an agent's work sessions include *mechanically separate* verification phases — either through explicit workflow orchestration (bob's `deliver-or-report`) or through implicit task structure (coach's gym-run cycles, tech-lead's implement-and-verify).

Reliant agents (may, scout, optimizer) lack workflow-level verification enforcement. Their write→verify gap is filled at runtime by the FM-3.3 guard, creating a dependency loop: the guard catches the miss, the agent retries, but the underlying behavior never changes because verification is never *architecturally required* in their session flow.

**The intervention is clear**: reliant agents need verification workflows, not more skills or text rules.

---

## Finding 1: The Structural Comparison

### 1.1 Full Feature Table

| Feature | Bob (L) | Coach (L) | Tech-Lead (L) | May (R) | Scout (R) | Optimizer (R) |
|---|---|---|---|---|---|---|
| **SOUL.md lines** | 90 | 75 | 79 | 74 | 49 | 129 |
| **Heartbeat lines** | 167 | 168 | 83 | 60 | 179 | 75 |
| **Heartbeat structure** | 4-step dispatcher | 4-step dispatcher + budget | 4-step dispatcher | 6-section coordinator | 4-step dispatcher | 4-step dispatcher |
| **Skills count** | 8 | 4 | 4 | 5 | 4 | 4 |
| **verify-after-edit version** | Generic (53L) | Data-aware (70L) | Data-aware (70L) | Data-aware (70L) | Generic (53L) | Generic (53L) |
| **verify-before-finish skill** | No | No | No | **Yes** | No | No |
| **Workflow adoption** | **deliver-or-report** (132 sessions) | **Gym workflows** (196 sessions) | **implement-and-verify** (referenced) | None (0 sessions) | None (2 sessions) | Minimal (44 sessions) |
| **Total sessions** | 2,497 | 2,572 | 1,987 | 4,115 | 1,009 | 1,585 |
| **Avg ops/session** | 7.4 | 12.6 | 9.5 | 2.3 | 8.1 | 12.7 |
| **Error rate** | 19.9% | 18.7% | 16.2% | 16.6% | 22.8% | 14.4% |
| **Avg quality** | 3.20 | 3.23 | 3.56 | 3.72 | 3.32 | 3.17 |
| **Avg efficiency** | 2.99 | 2.78 | 3.02 | 3.38 | 3.24 | 2.88 |
| **FM-3.3 digest mentions** | 17% (181/1073) | 17% (194/1158) | 12% (75/628) | 25% (125/496) | 22% (130/587) | 13% (83/617) |
| **Genuine FM-3.3 rate (Apr 11)** | **24%** ↓ | ~15% ↓ | ~10% ↓ | **71%** ↑ | **71%** ↑ | **67%** ↑ |

### 1.2 Key Observations

**What does NOT correlate with learning:**
- SOUL.md size (optimizer has the largest at 129L, is reliant; scout has smallest at 49L, also reliant)
- Skills count (bob has 8 skills vs 4-5 for others, but coach/tech-lead also have 4)  
- verify-after-edit version (may has the data-aware 70L version, same as learners coach/tech-lead)
- verify-before-finish skill (may is the ONLY agent with this skill, and she's the WORST reliant at 71%)
- Avg quality (may has the highest quality at 3.72, yet highest block rate)
- Heartbeat structure (scout and optimizer have 4-step dispatcher like learners)

**What DOES correlate with learning:**
- **Workflow adoption with built-in verification phases** (correlation = 1.0)
  - Bob: deliver-or-report (Phase 1 → Phase 2 → Phase 3 verification → Phase 3b content check)
  - Coach: Gym workflow cycles (run scenario → evaluate → compare baseline)
  - Tech-lead: implement-and-verify referenced in SOUL.md
  - May: 0 workflow sessions
  - Scout: 2 workflow sessions (essentially none)
  - Optimizer: 44 workflow sessions (but these are safe-edit/design-review, not verification-focused)

---

## Finding 2: Bob's `deliver-or-report` Is a Verification Machine

Bob's `deliver-or-report` workflow (in `agents/bob/workflows/deliver-or-report.ts`) is a 4-phase structural enforcement:

| Phase | What Happens | Verification Effect |
|---|---|---|
| Phase 1 | Analyze & plan (read-only, budget-capped) | Separates reading from writing |
| Phase 2 | Write deliverables | Narrowly scoped to writing only |
| Phase 3 | Existence check (pure JS, `existsSync`) | Mechanical verification — no LLM needed |
| Phase 3b | **Content verification by SEPARATE session** | Anti-FM-3.3: reads back every file in isolation |

**Phase 3b is the critical innovation.** It spawns a *new* agent session whose *only job* is to `read()` each deliverable file and confirm it matches the plan. This means:

1. The writing session cannot fabricate verification evidence (it's not the same session)
2. Verification is mechanically required — the workflow won't complete without it
3. The agent doesn't need to "remember" to verify — the workflow structure does it

Bob's heartbeat explicitly instructs: **"For WORK SESSION tasks, use `workflow.run('deliver-or-report', task)` to get structural verification guardrails."** This is not a suggestion — it's presented as the default dispatch method.

**132 out of 2,497 Bob sessions** (5.3%) used this workflow. That seems low, but these are the *work sessions* where deliverables are produced — exactly the sessions where FM-3.3 matters most. Bob's heartbeat sessions (the other ~95%) are dispatchers that fork work → into workflow-wrapped sessions.

---

## Finding 3: May's Paradox — Most Skills, Worst Performance

May is the most paradoxical case:
- **Only agent with verify-before-finish skill** → Still has 71% genuine block rate
- **Data-aware verify-after-edit skill (70L)** → Same as coach/tech-lead (learners)
- **Highest quality scores** (3.72 avg) → She does good work, just doesn't verify it
- **Most sessions** (4,115) → Most opportunities to "learn"

This is the **strongest possible confirmation of KE-106**: skills (text rules) do not produce training effects. May has *more* verification-related text in her prompt than any other agent, and she has the *worst* verification behavior.

### Why May Is Reliant: Task Architecture

May's heartbeat is a **flat coordinator structure** (6 sections, not 4-step dispatcher):
1. Dispatch Work → reads pending tasks, sends to other agents
2. Follow Up → reads dispatch-board.md, peeks sessions, updates board
3. Triage Failures → reads error data, routes to helpers
4. Research Projects → reads project files, dispatches
5. System Health → checks for stuck sessions
6. End-of-Cycle Reflection → self-assessment

**Every section involves reading and editing files** (especially dispatch-board.md), but these edits are *ephemeral coordination state*, not *deliverables*. May's write→edit→finish pattern is:

```
read(dispatch-board.md) → edit(dispatch-board.md) → read(dispatch-board.md) →
edit(dispatch-board.md) → ... → finish()
```

The FM-3.3 guard sees the edits and demands verification, but the edits are just board updates — there's nothing meaningful to verify. May's high block rate is partly a **false positive from the guard not distinguishing ephemeral coordination edits from substantive deliverables**.

However, may's work sessions (forked tasks) ALSO lack verification. She has 0 workflow-wrapped sessions. When may forks work, it's ad hoc — no structural verification.

---

## Finding 4: Scout and Optimizer — Missing Workflow Layer

**Scout's heartbeat** has extensive "verify" instructions scattered throughout (lines 64, 83, 100, 117, 177 — "For every write(): read() the file back to verify"). This is textual repetition of the verification rule — the exact approach that KE-002 and KE-106 prove doesn't work. Scout has 5 separate reminders to verify, and a 71% genuine block rate.

**Scout's 4-step dispatcher** is structurally similar to bob's, but critically lacks the workflow dispatch instruction. Where bob says "use `workflow.run('deliver-or-report', task)`", scout says use `agents.call({action: 'fork', ...})` — a raw fork without verification scaffolding.

**Optimizer** has 44 workflow sessions (safe-edit, design-review, enhance-cron), but these workflows are *build-focused*, not *verification-focused*. The safe-edit workflow helps with edit safety, not with deliverable verification. Optimizer's block rate (67%) is slightly lower than may/scout (71%), possibly because its workflows provide some incidental verification structure.

---

## Finding 5: The Mechanism — Workflow Verification as External Memory

The explanation for why workflows produce "learning" while skills don't is fundamentally about **session isolation** (the same factor KE-106 identified):

### Why Skills Fail (KE-106 mechanism)
```
Session N: Agent sees skill text → writes file → forgets to verify → guard blocks → agent verifies
Session N+1: Agent sees skill text → writes file → forgets to verify → guard blocks → same cycle
```
The skill is *in context* but doesn't change the generation pattern. The guard catches the error, but the catch doesn't persist to the next session.

### Why Workflows "Train" (new mechanism)
```
Session N: Agent calls workflow → Phase 1 writes → Phase 3b mechanically verifies → done
Session N+1: Agent calls workflow → Phase 1 writes → Phase 3b mechanically verifies → done
```
The workflow doesn't "train" the agent to verify. It **removes the need for self-verification entirely**. The agent never has to remember to verify because the workflow structure does it. The guard's job shifts from "catch missing verification" to "catch sessions that didn't use the workflow."

This is why bob's genuine rate decreased: **as more of his work sessions moved through `deliver-or-report`, fewer sessions had the opportunity to miss verification**. It's not behavioral change — it's architectural substitution.

### The Implication for KE-106
KE-106 is correct: guards don't train behavior. But KE-106 missed a nuance: **workflows that include verification as a structural phase produce the *appearance* of learning by reducing the opportunity for the error to occur.** The behavior doesn't change; the architecture compensates.

This is analogous to the difference between teaching someone to check blind spots (training) and installing a blind spot monitor (architecture). The monitor doesn't teach driving — it makes the skill unnecessary.

---

## Hypothesis Resolution

| Hypothesis | Verdict | Evidence |
|---|---|---|
| H-137a: Workflow adoption is the primary differentiator | **CONFIRMED** | Perfect correlation: all 3 learners have verification workflows, all 3 reliants lack them |
| H-137b: Dispatcher structure correlates with internalization | **PARTIALLY REJECTED** | Scout/optimizer have dispatcher structure but are reliant. The dispatcher is necessary but not sufficient — you also need workflows |
| H-137c: Task type drives bifurcation | **PARTIALLY CONFIRMED** | May's coordinator role creates high edit-frequency with ephemeral state. But scout has similar task types to bob (research, writing) and is still reliant |
| H-137d: Skill text differences are NOT causal | **CONFIRMED** | May has more verification text than any learner and the worst block rate |

---

## Finding 6: Intervention Proposal — Verification Workflow for Reliant Agents

### The Intervention

Create a lightweight verification workflow that reliant agents use for work sessions. Unlike bob's `deliver-or-report` (which is complex — 4 phases, 300+ lines), this should be a **minimal verification wrapper**:

```
Phase 1: Execute task (agent does normal work)
Phase 2: Verify deliverables (SEPARATE session reads back all written files)
```

This is the "minimum viable verification workflow" — Phase 3b of deliver-or-report extracted as a standalone wrapper. It:
1. **Is structural** (per KE-106 requirement): mechanically spawns a verification session
2. **Is not a guard** (per KE-106 finding): doesn't block and retry, instead pre-emptively verifies
3. **Is not text** (per KE-002): doesn't rely on the agent remembering to verify
4. **Is testable** in the gym: measure FM-3.3 rate before/after adding the workflow

### Agent-Specific Adaptations

**For May**: The intervention needs to distinguish between:
- Coordination edits (dispatch-board.md) → no verification needed
- Deliverable work sessions → wrap in verification workflow

May's heartbeat should add: "When forking a work session that produces files, use `workflow.run('verify-wrap', task)`"

**For Scout**: Scout's work sessions (deep dives, paper triage, library updates) produce files that should be verified. Add workflow instruction to scout's dispatch template:
```javascript
workflow.run('verify-wrap', `[WORK SESSION] ${task}`)
```

**For Optimizer**: Optimizer already has some workflow adoption (44 sessions). Add verification phase to existing workflows (safe-edit, design-review) rather than creating a new workflow.

### Gym Test Plan

1. **Baseline**: Run verification scenarios (skip-verification, verify-before-finish, convention-verify-edit) with scout (current prompts)
2. **Treatment**: Create lab fork with workflow-wrapped dispatch instructions
3. **Measure**: FM-3.3 rate change in gym scenarios
4. **Success criterion**: >20pp reduction in FM-3.3 rate

### Risk: KE-106 Concern

The intervention might not work if:
- Agents don't call the workflow (text instruction to use workflows = still text)
- The gym scenarios don't trigger the workflow path (scenarios are single-turn, workflows are multi-turn)
- The overhead of verification sessions is prohibitive (doubles session cost)

The first risk is the most serious. Even bob doesn't always use deliver-or-report. The question is whether agents will adopt the workflow. This is why the heartbeat instruction needs to be *structural* (the default dispatch template) rather than *advisory* ("consider using...").

---

## Revision to KE-137

The bifurcation finding is strengthened and clarified:

1. **Root cause identified**: Workflow-level verification enforcement, not prompt complexity or skill quantity
2. **Mechanism clarified**: Workflows don't "train" — they architecturally substitute for self-verification
3. **Prediction P-137b revised**: Adding workflow-level verification to reliant agents *should* reduce their block rate, unlike adding more guards or text rules
4. **New prediction P-137e**: May's block rate will NOT decrease from skill additions alone — only workflow-level structural change will help

---

## Actionable Recommendations

### Immediate (High Confidence)
1. **Build `verify-wrap` workflow** — Minimal 2-phase verification wrapper extracted from deliver-or-report Phase 3b
2. **Add workflow dispatch instructions to scout and optimizer heartbeats** — Not "consider using" but "use this for work sessions"
3. **Adapt may's heartbeat** to distinguish coordination edits from deliverable work, and use verify-wrap for the latter

### Experimental (Medium Confidence)
4. **Run EXP-138**: Gym test of verify-wrap on scout lab fork — baseline then treatment on verification scenarios
5. **Calibrate FM-3.3 guard for may** — Consider excluding edits to `dispatch-board.md` and other coordination files from the write pattern detection, since these are ephemeral state rather than deliverables

### Monitoring
6. **Track workflow adoption rate per agent** as a leading indicator — agents using verification workflows will show declining FM-3.3 rates
7. **Track "workflow-wrapped sessions" / "total work sessions"** ratio — should increase over time for successful intervention

---

## Tags
`guard-reliance`, `workflow-verification`, `structural-intervention`, `learner-reliant-bifurcation`, `KE-106-extension`, `KE-137-revision`, `H-137`
