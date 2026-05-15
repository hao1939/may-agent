# Agent System Design: Communication, Forward Motion, and Information Flow

## The Three Questions

1. **How do agents communicate?** Session-to-session, event-driven, simple.
2. **How does the system keep pushing forward?** Who raises questions, who fixes them, from facts not speculation.
3. **How does the system evolve?** Information inputs: user, experience, external — and how they flow to action.

---

## 1. Agent Communication

### Current State

We have several mechanisms, each invented ad-hoc:
- `followUp(sessionId, msg)` — queue a message to a living session
- `steer(sessionId, msg)` — interrupt a session mid-turn
- `onSessionComplete` → notify parent session (just implemented)
- `SIGNALS.md` — shared file for cross-agent awareness (Bob reads it)
- `todo.md` — agents add tasks to each other's todo files
- Cron heartbeats — periodic wakeup, poll-based

**The problem:** these are all point-to-point. There's no coherent event model. An agent can't say "I found something important" and have the right listener get it. We hardcode who talks to whom.

### Design: Session Events

The mental model: **sessions emit events, sessions subscribe to events.**

An event is just: `{ source: sessionId, type: string, payload: string }`

Types we need today:
- `task-complete` — "I finished what you asked" (already implemented via parent notification)
- `task-failed` — "I couldn't do it" (already implemented, same mechanism)
- `signal` — "I found something relevant" (currently SIGNALS.md file writes)
- `question` — "I need a decision" (currently written to pending-decisions.md and forgotten)

### How it works

**Events flow through the manager, not through files.**

```
Session A emits event → Manager routes it → Session B receives it as followUp
```

Routing rules (simple, in code, not config):

1. **`task-complete` / `task-failed`**: route to parent session (already done). Falls back to parent agent's persistent session.

2. **`signal`**: route to subscribers. An agent declares interest in its agent.json:
   ```json
   { "subscribes": ["signal"] }
   ```
   Manager delivers to that agent's persistent session. Today, only Bob would subscribe to signals. Tomorrow maybe others.

3. **`question`**: route to the agent's parent (up the chain). If the parent is May's chat session and user is present, it reaches the human. If nobody's there, it queues in the agent's workspace (like today's pending-decisions.md, but the system manages it).

### What this replaces

| Old mechanism | New equivalent | Status |
|---|---|---|
| SIGNALS.md file writes | `emit("signal", ...)` → routed to Bob | Replace |
| todo.md cross-writes | `emit("task-request", ...)` → routed to target agent | Replace |
| Parent session notification | `emit("task-complete", ...)` | Already done |
| pending-decisions.md | `emit("question", ...)` → routed upward | Replace |

### What this does NOT do

- No pub/sub infrastructure. No message queues. No event bus library.
- Events are just `manager.emit(sessionId, type, payload)` which calls `manager.followUp(targetSessionId, formatted_message)` under the hood.
- The routing table is code in manager.ts, not config.
- Events are ephemeral — fire and deliver. If the target isn't alive, they go to the persistent session. If no persistent session, they're logged to the session's output dir and picked up on next heartbeat.

### Implementation

Add to `SubagentManager`:
```typescript
emit(sourceSessionId: string, type: string, payload: string): void {
  const source = this.activeSessions.get(sourceSessionId);
  if (!source) return;
  
  const formatted = `[${type}] from ${source.agentName}: ${payload}`;
  
  switch (type) {
    case "task-complete":
    case "task-failed":
      // Already handled in handleCompletion. No change needed.
      break;
      
    case "signal":
      // Deliver to all agents that subscribe to signals
      for (const [sid, session] of this.activeSessions) {
        if (session.persistent && session.subscribes?.includes("signal")) {
          this.followUp(sid, formatted, "event");
        }
      }
      break;
      
    case "question":
      // Route up: parent session → parent agent persistent → log
      if (source.parentSessionId && this.activeSessions.has(source.parentSessionId)) {
        this.followUp(source.parentSessionId, formatted, "event");
      } else if (source.parentAgentName) {
        // find persistent session of parent agent...
        this.followUpToPersistent(source.parentAgentName, formatted);
      }
      break;
  }
}
```

Expose as a tool: `emit(type, payload)` — agents call it when they have something to say.

**Total cost: ~50 lines in manager.ts + 1 thin tool.**

---

## 2. Keeping Forward Motion

### Current State

The system moves forward through:
- **Heartbeats** (cron-driven, every 30min-24h) — agents wake up, drain todo, do work
- **User tasks** — human says "do X", May dispatches
- **Meta-loop** (Bob → Evaluator → Optimizer) — periodic improvement cycle

**The problem:** motion is mostly reactive. Nobody is *looking* at the system and saying "this is broken, let's fix it." The evaluator scores sessions after the fact. The optimizer fixes what Bob tells it to. Bob reads evaluations and SIGNALS. But nobody connects "this session failed because X" to "we should change Y" to "coder, implement Z" in a tight loop.

### Design: The Audit → Propose → Act Loop

Three roles, three concerns:

**Evaluator (fact-finder):** Already exists. Scores sessions. Finds failure patterns. Produces evidence.

**Bob (question-raiser):** Already exists but needs sharpening. Bob's job isn't to generate ideas — it's to read the evaluator's evidence, read user signals, read external discoveries, and ask: **"Is this a real problem? Does it warrant action?"**

Bob should produce **proposals** — not as design docs but as concise problem+solution+evidence statements:

```
## Proposal: Fix blind overwrite in compaction
- Evidence: 3/10 recent sessions scored 0 on efficiency due to data loss after compaction (eval IDs: ...)
- User signal: "we need to fix this" (human-inputs.md, line 847)  
- Proposed fix: Save compacted state to separate file, validate before replacing
- Assign to: coder (via implement-and-review workflow)
- Priority: HIGH (recurring failure, user flagged it)
```

**May (decision-maker):** Reviews proposals, approves/rejects, dispatches. This is what I already do when chatting with you. The heartbeat should do it autonomously too: read Bob's proposals, if evidence is strong and fix is clear, dispatch.

### What makes this different from today

Today: Bob produces design docs, analyses, syntheses. They're thoughtful but often inert — nobody acts on them unless the user asks.

Proposed: Bob produces **actionable proposals with evidence**. May's heartbeat reads proposals and dispatches implementation. The loop closes automatically.

### The key constraint: **Proposals must come from evidence, not speculation**

Bob cannot say "we should add X because it might be nice." Every proposal must cite:
- Evaluation data (session scores, failure patterns), OR
- User input (direct request or pattern from human-inputs.md), OR  
- System data (error logs, cost data, runtime metrics)

If there's no evidence, there's no proposal.

### Implementation

1. Bob's heartbeat already drains his todo. Add to his SOUL.md: after draining todo, scan recent evaluations for recurring failures. If a pattern appears 3+ times with no open proposal, write one to `agents/bob/workspace/proposals/YYYY-MM-DD-slug.md`.

2. May's heartbeat: after checking dispatched sessions, scan `agents/bob/workspace/proposals/` for new proposals. If evidence is solid and the fix is scoped, dispatch to implement-and-review. Mark the proposal as dispatched.

3. After implementation, evaluator scores the new sessions. Bob sees if the fix worked. Loop closes.

**Total cost: Convention change in Bob's SOUL.md + 10 lines in May's heartbeat.**

---

## 3. Information Flow → Evolution

### The Three Input Channels

**Channel 1: User Input (highest authority)**
- Source: Direct conversation, human-inputs.md
- Nature: Requirements, corrections, design decisions, priorities
- Flow: May receives → dispatches or records in philosophy.md / todo.md
- Current state: ✅ Works well. Human speaks, system acts.

**Channel 2: Experience (internal evidence)**  
- Source: Evaluations (734 and counting), session logs, error patterns, cost data
- Nature: "Session X failed because of Y", "Agent Z consistently scores low on efficiency"
- Flow: Evaluator measures → Bob synthesizes → proposals → May dispatches
- Current state: ⚠️ Partially working. Evaluator runs. Bob reads evaluations sometimes. The connection from pattern → proposal → fix is loose.

**The gap to close:** Bob needs structured access to evaluation summaries, not raw JSON files. The `analyze-failures` cron already does this — it writes to `agents/bob/workspace/analysis.md`. The problem is Bob's heartbeat doesn't always read it before generating proposals. Fix: add to Bob's heartbeat instructions.

**Channel 3: External Insight (research & community)**
- Source: Scout (arXiv, GitHub, Reddit), Amy/Amy-Kimi (XHS community), linked papers/repos
- Nature: "Other systems solve X using Y", "Community consensus is Z"
- Flow: Scout/Amy discover → write to SIGNALS.md → Bob reads → evaluates relevance → proposal if actionable
- Current state: ⚠️ Partially working. Scout and Amy produce great discoveries. Some reach Bob via SIGNALS.md. But the conversion rate from "interesting finding" to "concrete improvement" is low.

**The gap to close:** External insight should be matched to internal problems. "Scout found that verification is the #1 failure mode" is interesting. "Our evaluations show 15% of sessions have verification failures, and Scout's research suggests hard-gated exits as the fix" — that's actionable. Bob should be the one making this connection.

### The Information Architecture

```
                     ┌─────────────┐
                     │    User     │
                     │  (highest   │
                     │  authority) │
                     └──────┬──────┘
                            │ direct input, corrections
                            ▼
┌──────────┐         ┌─────────────┐         ┌──────────┐
│  Scout   │──signal──▶│    Bob     │◀──signal──│   Amy    │
│  Amy     │         │ (synthesis) │         │ Amy-Kimi │
│(external)│         └──────┬──────┘         │(external)│
└──────────┘                │ proposals       └──────────┘
                            ▼
                     ┌─────────────┐
                     │    May      │
                     │ (dispatch)  │
                     └──────┬──────┘
                            │ implement-and-review
                            ▼
                     ┌─────────────┐
                     │Coder + QA   │
                     │(implement)  │
                     └──────┬──────┘
                            │ completed code
                            ▼
                     ┌─────────────┐
                     │ Evaluator   │
                     │ (measure)   │
                     └──────┬──────┘
                            │ evidence
                            ▼
                     ┌─────────────┐
                     │    Bob      │──── loop closes
                     │(did it work?)│
                     └─────────────┘
```

### What connects them: Events, not files

Today, most cross-agent communication is file-based:
- SIGNALS.md for discoveries
- todo.md for task requests  
- proposals/ for proposals
- analysis.md for evaluation summaries

With the event system from §1, the flow becomes:
- Scout finds something → `emit("signal", "Verification is #1 failure mode")` → Bob's persistent session wakes up
- Bob writes proposal → `emit("proposal", "Fix verification failures")` → May's persistent session wakes up
- May dispatches → task-complete event → May knows it's done
- Evaluator scores → `emit("signal", "Verification failures down 15%→3%")` → Bob knows the fix worked

**Files remain the source of truth** (proposals, evaluations, analysis). Events are the notification layer — "hey, there's something new for you to look at."

---

## Summary of Changes

| Change | Scope | Effort |
|---|---|---|
| `manager.emit()` + routing for signal/question types | manager.ts | ~50 lines |
| `emit` tool for agents | new thin tool | ~20 lines |
| `subscribes` field in agent.json | agent-loader.ts | ~10 lines |
| Bob's SOUL.md: produce proposals from evidence | Convention | Text edit |
| May's heartbeat: read proposals, dispatch if solid | Convention + cron | Text edit |
| Bob's heartbeat: read analysis.md before proposing | Convention | Text edit |

**No new infrastructure. No new abstractions. Just plumbing the pieces we already have.**
