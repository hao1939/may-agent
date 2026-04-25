# Heartbeat as Dispatcher — Design

**Status:** Design complete, ready for review  
**Date:** 2026-04-05  
**Author:** Bob  

---

## 0. The Problem (with evidence)

**Bob uses 37 ops per heartbeat. His work sessions use 19.** The tool meant for quick maintenance is where all the heavy lifting happens. Across the system: heartbeats average 20.9 ops and 298s, while directed work sessions average 43.5 ops but are far more focused.

**Zero self-forks in 7 days.** Out of 1,083 sessions in the past week, zero used the fork mechanism. The `agents.fork()` tool exists and works — May uses it to dispatch to tech-lead and coach. But agents never fork themselves for sustained work. Every agent does all work inline in their heartbeat.

**75% of Bob's sessions are heartbeats.** 121 of 161. For QA it's 100%, amy-kimi 99%, scout 96%. These agents wake up, do heavy multi-step work in the heartbeat, hit the turn limit, and lose context. The next heartbeat cold-starts and reorients.

The fork mechanism exists. May proves the dispatch pattern works (she dispatches to OTHER agents). The missing piece: agents dispatching to THEMSELVES.

---

## 1. Core Concept

**Heartbeat = triage + dispatch. Work sessions = the actual work.**

A heartbeat session has three jobs, done in order, targeting 2-5 minutes total:

1. **OBSERVE** — What's happening? Check running sessions, pending requests, system health.
2. **DISCOVER** — What needs doing? Scan for new work, errors, research leads.
3. **DISPATCH** — Start the work. `agents.fork(self, task)` for anything needing >5 min. Do inline only for <5 min tasks.

The forked work session runs as long as needed — focused on one task, using checkpoints for progress saves, calling finish() when done or blocked. The next heartbeat checks on it.

---

## 2. Redesigned heartbeat.md Template

```markdown
# {Agent} Heartbeat

## ⚠️ This is a DISPATCH session, not a work session.
Target: 2-5 minutes, <15 ops. If a task needs more than 5 min of work, fork it.

## 1. OBSERVE (1-2 min)

### 1a. Check running sessions
```
agents({ action: "list" })
```
For each of YOUR running sessions:
- **Still running?** → peek it. Progressing? Let it continue. Stuck? See §Intervention.
- **Recently finished?** → Read its deliverables. Update your workspace if needed.
- **Failed?** → Diagnose. Retry with better context, or escalate.

### 1b. Check pending requests
Look at the "Injected: pending tasks" section above. Categorize each:
- **Quick (<5 min):** Do it inline in this heartbeat
- **Substantial (>5 min):** Queue for dispatch in step 3
- **Blocked:** Note why, skip

### 1c. System health (15 seconds)
Any stuck sessions? Recent failures in your domain? Only act on problems.

## 2. DISCOVER (1-2 min)

Spend 1-2 minutes scanning for new work. Agent-specific discovery goes here.
{Agent-specific discovery instructions — research for Bob, metrics for optimizer, etc.}

If you find something worth doing, add it to your dispatch queue.

## 3. DISPATCH (1 min)

For each substantial task identified in steps 1-2:
```
agents({ action: "fork", agent: "{self}", task: "..." })
```

**Fork message template:**
```
## Task: {one-line summary}

### Context
{2-3 sentences: why this task, what triggered it}

### Relevant files
- {file1}: {why it matters}
- {file2}: {why it matters}

### Prior state (if resuming)
{checkpoint data or previous session outcome}

### Definition of done
- {concrete deliverable 1}
- {concrete deliverable 2}

### ⚠️ This is a WORK SESSION, not a heartbeat.
Work until done or blocked. Use checkpoint() for progress saves.
Do NOT fork sub-tasks — do the work directly.
```

Track the sessionId so you can check on it next heartbeat.

## 4. CLOSE (30 seconds)
Write a 2-3 sentence brief to your journal. Call finish().
```

---

## 3. How the Agent Knows: Heartbeat vs Work Session

**The task string is the signal.** No infrastructure change needed.

- **Heartbeat:** Task contains `[heartbeat]`. The heartbeat.md instructions say "this is a dispatch session, target 2-5 min."
- **Work session:** Task does NOT contain `[heartbeat]`. The fork message includes `⚠️ This is a WORK SESSION, not a heartbeat.` and specific deliverables.

**Anti-recursion:** The work session's fork message explicitly says "Do NOT fork sub-tasks — do the work directly." A work session has a defined task and a definition of done. It works until that's met, then calls finish(). It never reads heartbeat.md.

If the work session encounters something truly out-of-scope, it notes it in finish(new_items=...) for the next heartbeat to pick up. It does NOT fork.

**Enforcement heuristic (optional, future):** If a session with `[heartbeat]` in its task exceeds 20 ops, inject a warning: "You're over-budget for a heartbeat. Fork remaining work." This is a soft nudge, not a hard limit.

---

## 4. Fork Context Template

What the forked session receives as its task string:

```markdown
## Task: {title}

### Context
{Why this work matters. What triggered it. 2-3 sentences max.}

### Relevant files
- {path}: {one-line description of relevance}

### Prior state
{If resuming from a previous session or checkpoint:}
- Previous session: {sessionId} ended with status={status}
- Last checkpoint: {summary from checkpoint data}
- Key decisions already made: {list}
{If fresh work:}
- No prior sessions on this task.

### Definition of done
- [ ] {Concrete deliverable with file path}
- [ ] {Measurable outcome}
- [ ] {Verification step}

### Constraints
- Work until done or blocked, then call finish()
- Use checkpoint() every ~15 minutes or after major milestones
- Do NOT fork sub-tasks — work directly
- If truly blocked, call finish(status='blocked', blockers=[...])
```

**Why this format works:** The forked session cold-starts with just this message plus its context.md. It needs (a) what to do, (b) why, (c) what files to read, (d) where prior work left off, and (e) when it's done. The template covers all five.

**Size budget:** Keep the fork message under 500 tokens. The session will read files itself — don't paste file contents into the message. Point to files, don't include them.

---

## 5. Session Management — Monitoring Protocol

### During heartbeat OBSERVE phase:

```
1. agents({ action: "list" })
   → See all running sessions, including your own forked work sessions

2. For each of YOUR sessions that's running:
   a. Check runtime — has it been running >15 min?
   b. agents({ action: "peek", sessionId: "..." })
      → Read last 10 messages to assess progress

3. Assess:
   - Making progress (new files, new tool calls, moving forward) → Let it run
   - Stuck (same error repeated, no new work in last 5 messages) → Intervene
   - Done (called finish(), session ended) → Read results, update workspace
```

### What to track between heartbeats:

The agent doesn't need to maintain a tracking file. The infrastructure already tracks:

- **Session ID** — from the fork return value, queryable via `agents.list`
- **Session status** — done/error/running via `agents.list` or DB query
- **Session outcome** — via `agents.peek` or reading finish() deliverables
- **Request status** — via `agents.requests` (fork creates a tracked request automatically)

If the agent wants a local view, they can write to `workspace/active-sessions.md`:
```
## Active Work Sessions
- s_12345: "Implement digest Phase 1" — forked 2026-04-05 10:00, running
- s_12346: "Research skill transfer" — forked 2026-04-05 09:30, done (success)
```

But this is optional — `agents.list` is the source of truth.

---

## 6. Intervention Decision Tree

When the heartbeat observes a running forked session:

```
Is the session still running?
├── NO (ended)
│   ├── status = done/success → Read deliverables. Is follow-up needed? Dispatch it.
│   ├── status = partial → Read next_steps. Re-fork with that context.
│   ├── status = error → Read error. Was it transient (OOM, timeout)?
│   │   ├── YES → Re-fork with same task + "previous attempt failed: {error}"
│   │   └── NO (logic error) → Analyze. Fix approach, re-fork with new strategy.
│   └── status = blocked → Read blockers. Can you unblock? If not, escalate.
│
└── YES (still running)
    ├── Runtime < 10 min → Too early to judge. Let it run.
    ├── Runtime 10-30 min → Peek last 10 messages.
    │   ├── Making progress (new files, advancing) → Let it run.
    │   ├── Looping (same error 3+ times) → Cancel + re-fork with guidance.
    │   └── Silent (no recent tool calls) → Might be in long LLM call. Wait 1 more cycle.
    └── Runtime > 30 min → Peek. Is it near done?
        ├── YES (wrapping up) → Let it finish.
        └── NO → Cancel. Re-fork with checkpoint data + narrower scope.
```

**Key principle:** Don't micromanage. Check once per heartbeat cycle (~1 hour). If it's progressing, leave it alone. Intervene only on clear failure signals (repeated errors, excessive runtime with no progress).

**When to cancel vs let run:**
- Cancel if: same error 3+ consecutive times, runtime >30min with no visible progress, task is obsolete
- Let run if: making progress (even slowly), runtime reasonable for task complexity, intermittent errors being handled

---

## 7. Agent-Specific Heartbeat Customization

The template (§2) is generic. Each agent fills in the DISCOVER section differently:

### Bob (Architect/Researcher)
```markdown
## 2. DISCOVER
- Scan `agents/shared/knowledge/library/` for new additions (titles only, not full reads)
- Check `agents/shared/knowledge/hypotheses/` for unverified hypotheses
- Check experiment results in `agents/shared/knowledge/experiments/`
- If a pattern emerges across multiple sources → queue a synthesis task for dispatch
```

### Optimizer
```markdown
## 2. DISCOVER
- Query may.db for waste signals: high-op sessions, repeated failures, redundant work
- Check workflow metrics: which workflows have degraded?
- Look for new efficiency opportunities based on recent system changes
```

### Coach
```markdown
## 2. DISCOVER
- Check recent evaluations for skill gaps
- Review training sprint results
- Look for behavioral patterns across agents
```

### QA, Scout, Amy-kimi
```markdown
## 2. DISCOVER
- Check for assigned work in pending requests
- {Domain-specific scanning}
```

These agents are mostly reactive (work arrives via requests). Their heartbeats will be very short — often just OBSERVE + CLOSE with nothing to dispatch.

---

## 8. Anti-Patterns to Avoid

### 1. Infinite fork chains
**Problem:** Work session encounters a sub-task, forks itself, that fork forks again...  
**Prevention:** Work session task includes "Do NOT fork sub-tasks." Work sessions don't read heartbeat.md (so no dispatch instructions). If they need to note follow-up work, they use `finish(new_items=[...])`.  
**Structural guard:** A session whose parentSessionId points to a non-heartbeat session of the same agent should NOT fork. (This can be enforced in infra later, but the prompt instruction handles it now.)

### 2. Abandoned sessions
**Problem:** Agent forks a session, then never checks on it. Session finishes but results are never read.  
**Prevention:** The OBSERVE phase of every heartbeat starts with `agents.list`. Completed sessions are visible. The heartbeat reads their results. Additionally, `agents.requests(filter='active')` shows outstanding tracked requests.  
**Fallback:** The digest system (§session-digest.md) creates a digest entry when sessions end. Even if the heartbeat doesn't check, the work is recorded in the DB.

### 3. Context loss between sessions
**Problem:** Forked session does 20 minutes of work, finishes. Next heartbeat needs to continue but doesn't know what happened.  
**Prevention:** Fork message includes "use checkpoint() for progress saves." The checkpoint data persists to `.state/checkpoints/`. The finish() call records deliverables and next_steps. The next heartbeat reads these when deciding whether to re-fork.  
**The fork message for continuation includes Prior State section** with checkpoint summary and key decisions.

### 4. Heartbeat bloat
**Problem:** Agent starts doing "just one quick thing" inline in the heartbeat, which spirals to 30 ops.  
**Prevention:** The heartbeat.md header says "target 2-5 min, <15 ops." The inline threshold is explicit: <5 min tasks only. Everything else gets forked.  
**Soft enforcement:** If a heartbeat exceeds 15 ops, the infrastructure could inject a warning. Not a hard blocker — sometimes a heartbeat legitimately needs more ops (e.g., reading 5 completed sessions' results).

### 5. Redundant re-forks
**Problem:** Heartbeat sees a task that needs doing, forks it. Next heartbeat sees the same task (because the fork hasn't finished yet), forks again. Two sessions do the same work.  
**Prevention:** The OBSERVE phase checks `agents.list` FIRST. If a session is already running on that task, don't fork another. The request tracking DB also prevents duplicate sends.

### 6. Over-monitoring
**Problem:** Every heartbeat peeks every running session, burning ops on monitoring instead of useful work.  
**Prevention:** Only peek sessions that have been running longer than expected (>10 min), or that had issues last time you checked. Recently-forked sessions (<10 min) don't need peeking.

---

## 9. Expected Impact

### Quantitative predictions (testable)

| Metric | Current | Predicted | How to measure |
|--------|---------|-----------|----------------|
| Heartbeat avg ops (Bob) | 37.3 | <15 | `SELECT AVG(opCount) FROM sessions WHERE agent='bob' AND task LIKE '%heartbeat%'` |
| Heartbeat avg duration (Bob) | 441s | <180s | Same query with duration |
| Forked work sessions per day | 0 | 5-15 | `SELECT COUNT(*) FROM sessions WHERE kind='fork' AND source='agents.fork'` |
| Work session completion rate | N/A | >80% status=done | `WHERE kind='fork' AND status='done'` |
| Context continuity (sessions referencing prior work) | ~0% | >50% of forks | Check for "Prior state" in task text |

### Qualitative predictions

- **Better research depth for Bob:** Instead of 7-minute shallow dives interrupted by heartbeat limits, Bob forks a 20-minute deep synthesis session that uses checkpoints and produces a complete knowledge entry.
- **Cleaner separation of concerns:** Heartbeat = awareness. Work = execution. Currently both are muddled in the same session.
- **Natural load balancing:** If an agent has 3 pending tasks, it forks all 3. They run in parallel (subject to concurrency limits). Currently tasks are processed serially across heartbeat cycles.

---

## 10. Rollout Plan

### Phase 1: Bob only (pilot, 1-2 days)
- Rewrite `agents/bob/heartbeat.md` to the dispatcher template
- Add the "⚠️ This is a WORK SESSION" anti-recursion instruction to Bob's context.md
- Monitor: does Bob actually fork? Do forked sessions complete? Do heartbeats shrink?
- Success criteria: Bob heartbeats drop below 20 ops avg, at least 3 forks/day

### Phase 2: Optimizer + Coach (days 3-5)
- Apply same heartbeat rewrite
- These agents have the clearest work/dispatch separation after Bob
- Monitor same metrics

### Phase 3: All agents (days 6-10)
- Apply to remaining agents
- Some (QA, scout) may not change much — they're already reactive with short heartbeats
- The template gracefully handles "nothing to dispatch" — heartbeat is just OBSERVE + CLOSE

### Phase 4: Infrastructure support (optional, after behavioral validation)
- Soft op-count warning injection for heartbeats exceeding 15 ops
- Dashboard showing heartbeat vs work session split per agent
- Forced checkpoint timer for work sessions (already planned in session-digest design)

---

## 11. Relationship to Existing Systems

### Session Digest System
The digest system (DESIGN-session-digest.md) provides the observability layer. When a forked work session creates checkpoints, those generate digest entries. When it calls finish(), that generates an end digest. The heartbeat reads these digests in the OBSERVE phase to understand what happened.

**Synergy:** Dispatcher pattern generates more sessions (more forks), but each is more focused. Digest system handles the increased session count — it's designed for per-session tracking regardless of volume.

### Agent Calling Guide
The calling guide already documents fork semantics: new root, originSessionId link, fire-and-forget with sessionId return. The dispatcher pattern is the USAGE pattern for these existing mechanisms. No infrastructure changes needed.

### Request Tracking
`agents.fork()` automatically creates a tracked request. `agents.requests(filter='active')` shows all outstanding work. The heartbeat's OBSERVE phase uses this to know what's in flight.

### Checkpoint System
Work sessions use `checkpoint()` for progress saves. The heartbeat reads checkpoint data when deciding whether/how to re-fork a failed or partial session. This is the context bridge between sessions.

---

## 12. Open Questions

1. **Concurrency limits:** Can an agent have 3 forked sessions running simultaneously? The infrastructure supports it (manager.runAgent is fire-and-forget), but is there a practical limit? Resource contention? LLM rate limits?

2. **Heartbeat frequency with dispatcher pattern:** If heartbeats are now 2-5 min instead of 7+, should they run more frequently? Or keep the same cadence and accept idle time? Current cron is ~1 hour.

3. **Cross-agent fork:** Should Bob be able to fork tech-lead for implementation work, or only fork himself? Currently May is the dispatcher for cross-agent work. Keeping that boundary is probably wise — agents self-fork, May cross-dispatches.

4. **Session naming:** Forked sessions from heartbeat show up as `kind=fork` in the DB. Should we add a tag/label to distinguish "self-fork work session" from "cross-agent delegation fork"? The `source` field could carry this: `source='self-fork'` vs `source='agents.fork'`.
