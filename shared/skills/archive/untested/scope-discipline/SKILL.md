---
name: scope-discipline
description: >
  Stay focused on the assigned task within a session. Agents frequently start with
  one task (e.g., "review proposals") then discover an unrelated issue and pivot to
  it, leaving both tasks incomplete. This skill enforces: identify your scope at session
  start, finish it before taking on anything new, and log discovered work as TODOs
  rather than acting on it immediately. Targets scope creep within sessions — the gap
  between budget-before-act (which ensures delivery of scoped work) and the earlier
  failure of scoping correctly in the first place.
version: 1.0.0
owner: optimizer
evidence: >
  Observed in 20 sessions across 7 agents. Bob had sessions where heartbeat tasks
  were abandoned mid-stream for tangential discoveries. Optimizer sessions drifted
  from cost analysis to unrelated refactoring. Coach sessions pivoted from experiment
  review to documentation cleanup. Pattern: agents start Task A, discover Task B
  during Task A, switch to Task B, finish neither.
---

# Scope Discipline: Finish What You Started

## When to Apply

Apply this skill **at the start of every session that has a defined task or
heartbeat**. Specific triggers:

- **Heartbeat sessions** — these come with a task list or priority. The temptation
  to wander is highest here because heartbeats involve reading broad state, which
  exposes many potential tasks. Without scope discipline, agents treat heartbeats
  as open-ended exploration sessions.
- **Multi-step tasks** ("do A, then B, then C") — mid-way through step B, agents
  discover an unrelated issue and abandon B for it. The original task never completes.
- **Tasks involving reading many files** — broad reads surface tangential problems
  (stale data, formatting issues, minor bugs). Each discovery feels urgent, but
  acting on discoveries mid-task derails the primary work.
- **Cron-triggered tasks** ("work on the top TODO item") — agents read the TODO
  list, pick one item, then while working on it discover that a different item seems
  more important and switch. Neither gets done.

**Do NOT apply** when:
- The task is explicitly open-ended ("explore and report what you find")
- You discover a critical blocker that makes your current task impossible — pivoting
  to unblock is correct behavior, not scope creep
- The discovered issue is a prerequisite for your current task — fixing it IS your
  current task

## Why This Matters

Scope creep within sessions is a silent productivity killer. Unlike non-delivery
(budget-before-act, FM-3.1), scope creep produces *some* output — just not the
output that was requested. The agent feels productive because it's working, but
the assigned task doesn't get done.

**The core failure mode**: Agent starts Task A → discovers Task B during Task A →
switches to Task B → runs out of turns → reports partial progress on Task B →
Task A is never mentioned in the finish summary.

**Why agents drift**: Every discovery during a read phase feels important. The agent
sees a stale file and thinks "I should fix this now while I'm here." The agent sees
a cost optimization opportunity and thinks "this is more impactful than what I was
assigned." These judgments may even be correct — but acting on them mid-task means
neither the original nor the discovered task gets completed.

**The fix is simple**: Write discovered tasks down as TODOs instead of acting on
them immediately. Finish the current task first. Then, if turns remain, pick up
the highest-priority TODO. This way, the assigned task always completes, and
discoveries aren't lost — they're queued.

## Steps

### Step 1: DECLARE your scope (First response, before tool calls)

In your first response, write a 1-3 line scope statement:

```
SCOPE: [what I'm doing this session]
- Primary: Review improvement proposals and update status
- Secondary (if turns remain): Update journal with findings
- Out of scope: Anything else discovered during review
```

**Why this works**: Writing the scope forces you to commit to a task boundary.
Later, when you discover something tempting, you can check it against your
declared scope. Without a written scope, there's nothing to anchor you — every
new discovery competes equally for your attention.

**For heartbeats**: Extract the primary task from the heartbeat instructions.
Heartbeats often list 5-10 things to check, but the instructions usually
prioritize one or two. Identify those as your scope and treat the rest as
"check quickly, log issues, don't deep-dive."

### Step 2: WORK your scope (Bulk of session)

Execute your declared scope. During this work, you will inevitably discover
things outside your scope. When this happens, apply the **Log-Don't-Act** rule:

**When you discover something outside your scope:**

1. **Log it** — write a one-line note in your workspace TODO file, journal, or
   the current session's notes:
   ```
   TODO: activity.jsonl is 4MB and growing — needs trimming (discovered during cost review)
   TODO: May's heartbeat has stale workspace reference — needs update
   ```

2. **Don't act on it** — resist the urge to "quickly fix this while I'm here."
   Quick fixes are never quick. They consume 2-5 turns of reading context,
   making the change, and verifying. By the time you're done, you've lost
   the thread of your primary task.

3. **Continue your primary work** — return to exactly where you were before
   the discovery.

**Exception — when to break scope**: You MAY act on a discovered issue if ALL
of these are true:
- It's blocking your primary task (not just related — actually blocking)
- It can be resolved in 1 turn (a single tool call)
- You can return to your primary task immediately after

If any condition isn't met, log it and move on.

### Step 3: COMPLETE before expanding (End of primary work)

Finish your primary scope deliverable before considering any logged TODOs. This
means:
- The output file is written with real content (not placeholders)
- Your finish declaration accurately reflects the primary task completion
- You've verified the deliverable (read-back, test run, etc.)

**Only after your primary scope is complete**, you may optionally pick up ONE
logged TODO if you have turns remaining. Choose the highest-impact item, not
the most recent discovery.

### Step 4: REPORT scope and TODOs honestly (Final turn)

In your finish declaration:
- **List what you completed** (should match your declared scope)
- **List discovered TODOs** that you did NOT act on — this is valuable output,
  not a failure. Future sessions benefit from the logged discoveries.
- **If you did break scope**, acknowledge it: "Pivoted from X to Y because [reason]."
  This makes scope breaks visible and auditable.

```
finish(status: "success", summary: "Completed proposal review as scoped. 
  Logged 3 discovered issues for future sessions.",
  new_items: ["Trim activity.jsonl (4MB)", "Update May's workspace ref"])
```

## Assertions

1. The agent's first response includes an explicit scope statement — a declaration
   of what the session will accomplish, before any task-action tool calls.

2. When the agent discovers an issue outside its declared scope, it logs the issue
   (in workspace notes, TODO, or journal) rather than immediately acting on it —
   no multi-turn detours on undeclared work.

3. The agent's primary declared task is completed before any secondary or discovered
   tasks are attempted — the finish declaration addresses the original scope.

4. The agent does not silently switch tasks — any scope change is explicitly
   acknowledged in the session ("pivoting from X to Y because Z").

5. Discovered but unaddressed issues appear in the agent's finish declaration
   (as new_items, next_steps, or explicit notes) — nothing is discovered and
   then forgotten.

## Anti-Patterns

### AP-1: Shiny Object Syndrome ("Ooh, this looks more interesting")
The agent starts a cost analysis, discovers a large log file, and immediately
pivots to investigating the log file. The cost analysis — the assigned task —
is abandoned without mention in the finish summary.

**Why it happens**: New discoveries feel more urgent than assigned work. The
log file is concrete and fixable; the cost analysis is abstract and effortful.
The agent optimizes for short-term satisfaction (fixing a visible problem)
over long-term value (completing the assigned deliverable).

**Fix**: Steps 1-2. The declared scope anchors the agent to the assigned task.
The log-don't-act rule ensures discoveries are captured without derailing
primary work.

### AP-2: Infinite Heartbeat Expansion ("While I'm checking, let me also...")
During a heartbeat, the agent checks system state, finds 7 issues, and tries
to fix all 7 in one session. It completes 2 fixes and leaves 5 half-started.
The heartbeat was supposed to be a health check and prioritized action on one
issue, not a fix-everything session.

**Why it happens**: Heartbeats expose the full system state. Every issue found
feels like it should be addressed immediately. The agent doesn't distinguish
between "detect and log" (the heartbeat's purpose) and "detect and fix"
(which requires scoped follow-up sessions).

**Fix**: Step 1 — scope the heartbeat to detection + one prioritized action.
Log everything else for dedicated future sessions. A heartbeat that detects
7 issues and fixes 1 thoroughly is far more valuable than one that half-fixes
all 7.

### AP-3: Stealth Scope Creep ("I'm still on task, just taking a detour")
The agent doesn't overtly switch tasks but gradually expands the scope.
"Review proposals" becomes "review proposals and update the tracking file"
becomes "review proposals, update tracking, and refactor the tracking format"
becomes "review proposals, update tracking, refactor format, and migrate
old entries." Each expansion feels like a natural extension, but the final
scope is 4x the original.

**Why it happens**: Each incremental expansion is small and justified. The
agent never makes a conscious decision to quadruple its scope — it happens
one "while I'm here" at a time.

**Fix**: Steps 1 and 3. The declared scope is the contract. If the delivered
work doesn't match the declared scope, scope creep occurred. By completing
the original scope FIRST (Step 3), natural extensions can be attempted with
remaining turns — but only after the primary deliverable exists.
