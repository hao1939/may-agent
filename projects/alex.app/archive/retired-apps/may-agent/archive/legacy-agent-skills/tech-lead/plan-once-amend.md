---
name: plan-once-amend
version: 1.0.0
description: >
  Declare your session plan ONCE, then track progress by marking items done/blocked
  instead of redeclaring the entire plan from scratch. Bob emits 2.6 plan declarations
  per session (7/8 sessions with 2+ plans), with a worst case of 5 full replans in
  a single 35-tool-call session. Each replan wastes 200-400 tokens of context,
  re-lists already-completed items, and introduces scope drift. Optimizer, coach,
  may, and tech-lead average <0.5 plans/session. This skill enforces the efficient
  pattern: plan once, amend in place.
owner: optimizer
evidence: >
  8 Bob sessions analyzed (s_97 through s_117). Bob averages 2.6 plan declarations/session
  vs 0.0-0.6 for optimizer/coach/may/tech-lead. Session s_1774310823764_100: 5 plans,
  35 tool calls — plans 1-3 targeted same task (C1.5 wiring), plan 4 drifted to
  unrelated cron outage, plan 5 returned to original task. Session s_1774310742544_98:
  3 plans, 53 tool calls. QA also shows 2/8 sessions with replanning. Replanned sessions
  average 30+ tool calls vs 10-15 for single-plan sessions.
---

# Plan Once, Amend

## When to Apply

Apply at the **start of every session** when you declare what work you'll do.
The trigger is the moment you write "I will:" or "This heartbeat I will:" — 
this is your ONE plan declaration.

## The Rule

### 1. Declare Once
At session start, write your plan as a numbered list:

```
**Plan:**
1. [ ] Verify finish-guard wiring in src/
2. [ ] Analyze recent FM-3.1 evaluation trends
3. [ ] Update focus-tasks.md with findings
```

### 2. Track Progress In-Place
As you complete or get blocked on items, update mentally (and in checkpoint data):
- `[✅]` = completed
- `[❌ reason]` = blocked, with one-line reason
- `[➕ new-item]` = added mid-session (append to list, don't rewrite)

### 3. Never Redeclare
When blocked on an item:
- **DO**: Mark it `[❌]` and move to the next item
- **DO**: Add a new item with `[➕]` if you discover urgent work
- **DON'T**: Emit a new "This heartbeat I will:" block
- **DON'T**: Rewrite the plan from scratch with overlapping items

### 4. Scope Guard
If you find yourself wanting to add more than 2 new items mid-session,
STOP and ask: "Is this scope drift? Should this be a next-session task?"
If yes → note it in your checkpoint's `next_steps` instead of adding it now.

## Assertions

1. The agent declares exactly ONE plan at session start — there is only one
   "I will:" or "Plan:" block in the entire session transcript. Subsequent
   messages may add items (`[➕]`) or mark items done/blocked, but never
   redeclare the full plan from scratch.
2. When the agent encounters a blocker on a plan item, it marks that item
   blocked (with a reason) and moves to the next item — it does NOT emit
   a new plan that restates already-completed or already-blocked items.
3. The agent does not add more than 2 new items mid-session — if it discovers
   more work, it defers to `next_steps` in its checkpoint or finish call
   rather than expanding the current plan unboundedly.
4. Each plan item has a clear resolution by session end: completed (✅),
   blocked with reason (❌), or explicitly deferred — no items silently
   disappear between plan declaration and session finish.
5. The total number of tool calls in a session that follows this skill does
   not exceed 25 — plan stability prevents the 30-50+ call bloat seen in
   replanning sessions.

## Anti-Patterns

### AP-1: Full Replan on First Obstacle
The agent hits a blocker on plan item #1 and responds by declaring an entirely
new plan that restates the remaining items plus a modified version of the
blocked item. This wastes 200-400 tokens per replan and often introduces
subtle scope drift (items get reworded, priorities shift).

**Real example** (Bob session s_1774310823764_100): Plans 1-3 all targeted
the same C1.5 wiring task with slightly different wording. Each replan added
tokens but zero new information. By plan 3, the agent had spent 12 tool calls
without completing a single item.

**Why it happens**: The agent treats a plan as disposable — something to
draft from current context rather than a commitment to track. When context
shifts (even slightly), the agent re-derives the plan from scratch rather
than amending the existing one.

**Fix**: Mark the blocked item `[❌ reason]` and move to the next item.
If the blocked item needs a different approach, add a new item with `[➕]`
that describes the alternative — don't rewrite the whole plan.

### AP-2: Scope Drift via Replanning
The agent discovers something unrelated mid-session and uses it as an excuse
to declare an entirely new plan centered on the new discovery, abandoning
the original plan's remaining items.

**Real example** (Bob session s_100): Plan 4 ("Investigate Cron Outage")
appeared after 3 plans about C1.5 wiring. The cron outage was genuinely
discovered, but it wasn't the session's assigned work. The agent drifted
to it because replanning felt like a fresh start.

**Why it happens**: Replanning resets cognitive state. The agent forgets the
sunk cost of partially-completed items because the new plan doesn't reference
them. Without a persistent checklist, there's no visible reminder of abandoned
work.

**Fix**: Apply the Scope Guard (Step 4). New discoveries get a `[➕]` item
only if urgent and small. Otherwise, note them in `next_steps` for the next
session. The original plan's items must all reach a resolution before session
end.

### AP-3: Duplicate Items Across Plans
The agent's second plan includes items that were already completed or already
blocked in the first plan, because the replan was derived from scratch rather
than from the current state.

**Real example** (Bob session s_98): "Analyze Failure Trends" appeared as an
item in plans 1, 2, and 3. Each time the agent re-listed it, re-prioritized
it, and re-started the analysis from the beginning — losing partial progress
from previous attempts.

**Why it happens**: Each plan is generated from the session context (task
description + recent findings), not from the previous plan's state. Without
explicit tracking of what's done vs. what's remaining, the agent re-derives
the same items.

**Fix**: Track progress in-place with checkmarks. The plan is a living
checklist, not a disposable draft. Only `[➕]` items and `[❌]` marks
change it — the original items and their status persist.

## Worked Example

❌ **Bad (from real session — 5 plans, 35 calls):**
```
Plan 1: "Audit C1.5 Code, Analyze Trends"
[3 tool calls, can't find file]
Plan 2: "Locate & Verify C1.5 Wiring, Analyze Trends"  ← near-duplicate!
[4 tool calls, still stuck]
Plan 3: "Locate Finish Tool Handler, Verify C1.5"  ← 3rd attempt same task!
[5 tool calls, discovers unrelated issue]
Plan 4: "Investigate Cron Outage"  ← scope drift!
[6 tool calls]
Plan 5: "Verify Duplicate Briefs, Draft Brief"  ← back to original
```

✅ **Good (same session, plan-once-amend):**
```
Plan:
1. [ ] Audit C1.5 Code in src/
2. [ ] Analyze FM-3.1 trends from evaluations
3. [ ] Update focus-tasks.md

[3 tool calls → can't find finish tool in expected location]
1. [❌ src/app/ doesn't exist, finish tool not in expected path]
   → search-strategy-escalation: try `find src -name "*.ts" | xargs grep finish`
[2 more calls → found it via broader search]
1. [✅] Found finish-guard.ts, verified wiring
[3 calls for step 2]
2. [✅] 0 FM-3.1 in recent evals, pattern improving
[➕] Discovered cron errors → noted for next session
3. [✅] Updated focus-tasks.md
```

## Synergies
- **search-strategy-escalation**: When a plan item is blocked by failed search,
  escalate the search method instead of replanning
- **budget-before-act**: Count remaining ops before adding new plan items
- **stale-approach-fixation**: If 3 attempts at a plan item fail, mark it ❌
  and move on — don't replan around it

## ⚠️ Task-Type Restriction

Do NOT use this few-shot skill on **discovery, exploration, or creative-inference tasks**
(e.g., knowledge integration, open-ended research, novel pattern discovery).
KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open
exploration these tasks require. Only apply this skill to structured sessions where
plan stability is the core challenge.

## Measurement
- Count "I will:" / "Plan:" declarations per session → target: exactly 1
- Sessions with 1 plan should average <20 tool calls
- Scope drift indicator: >2 `[➕]` items added mid-session
