# Agent Calling & Context Design

## Three Calling Patterns

| Action | Behavior | Session tree | Use when |
|--------|----------|-------------|----------|
| `call` | Sync, blocks, returns result | Child of caller (same root) | Need the result to continue |
| `fork` | Async, returns immediately | New root, but carries origin reference | Parallel work, May staying responsive |
| `message` | Fire-and-forget, heartbeat pickup | No session until picked up | Background, not time-sensitive |

## Session Tree

```
call creates children under the same root:

  Root (May chat)
    ├── call("tech-lead", task)          ← child
    │     ├── call("coder", task)        ← grandchild
    │     └── call("qa", review)         ← grandchild
    └── call("coder", other-task)        ← child

fork creates a new root with an origin link:

  Root A (May chat)
    └── fork("tech-lead", big-task)      ← returns sessionId, May continues

  Root B (forked session, originSessionId → Root A)
    ├── call("coder", task)              ← child of Root B
    └── call("qa", review)              ← child of Root B

  Coder in Root B can:
    - query tech-lead (parent) ✅
    - query Root A via origin link ✅ (read-only, summary only)

message creates nothing until picked up:

  message("bob", "review this design")   ← persisted as event (owner=bob)
                                          ← bob sees it in inbox on next heartbeat
```

### Fork carries an origin reference

When May forks, the forked session gets `originSessionId` pointing back to May's session. This is NOT a parent — the forked tree is independent. But agents in the forked tree can query the origin for context:

```
agents({ action: "context", scope: "origin" })
→ the session that triggered this fork (May's recent activity)
```

This means: May writes a short task, forks tech-lead. Tech-lead needs more context → queries origin → sees what May was discussing with the human.

## Context Query

### Actions

```
agents({ action: "context" })
→ parent session's handoff summary (default)

agents({ action: "context", scope: "origin" })
→ the session that forked this tree (if applicable)

agents({ action: "context", scope: "root" })
→ root of the current call tree (the forked session itself)

agents({ action: "context", scope: "workflow" })
→ all completed steps in the current workflow (if inside one)
   returns: [{ step: "coder", sessionId, summary }, { step: "qa", sessionId, summary }]
```

### What the summary contains

Uses `summarizeForHandoff()` plus finish() structured data when available:
- Files read and written
- Commands run and exit codes
- Errors encountered
- Agent's final response (truncated)
- **finish() data**: deliverables, verification_evidence, status, blockers (if present)

finish() data is more structured than the raw transcript summary. When available, it's included.

### Workflow context: how siblings see each other

Inside a workflow, each step runs as a separate session. The workflow engine tracks completed steps. An agent doesn't need to know sibling session IDs — it queries the workflow:

```
agents({ action: "context", scope: "workflow" })
→ [
    { step: "coder", summary: "Changed src/build.js, ran tests, 2 files written" },
    { step: "qa", summary: "FAIL: missing error handling for empty input" }
  ]
```

The workflow engine provides this from its step records. The agent asks "what happened before me in this workflow?" and gets a structured answer.

### Access rules

| Query | From call tree | From forked tree | From message |
|-------|---------------|-----------------|-------------|
| Parent | ✅ | ✅ (within fork's tree) | ❌ |
| Origin | N/A (call trees don't fork) | ✅ (read-only summary) | ❌ |
| Root | ✅ | ✅ (fork's root) | ❌ |
| Workflow | ✅ (if inside workflow) | ✅ (if inside workflow) | ❌ |
| Arbitrary sessionId | ✅ (same tree only) | ✅ (same tree only) | ❌ |

## When to Use Each Pattern

### May dispatching work

| Situation | Pattern | Why |
|-----------|---------|-----|
| "Fix this bug now" | `fork("tech-lead", task)` | Immediate, May stays responsive |
| "When you get a chance, review this" | `message("bob", task)` | Not urgent, heartbeat pickup |
| "What's in this file?" | `call("coder", "read X")` | May needs the answer right now (rare — May usually reads herself) |

### Tech-lead inside a fork

| Situation | Pattern | Why |
|-----------|---------|-----|
| Run code-review loop | `workflow code-review-loop` | Structured, blocking for tech-lead |
| Quick coder task | `call("coder", task)` | Get result, decide next step |
| Ask QA to review | `call("qa", review)` | Get verdict, maybe loop back to coder |

### Inside a workflow

| Situation | Pattern | Why |
|-----------|---------|-----|
| Run a step | `ctx.runAgent("coder", task)` | Always sync |
| Run sub-workflow | `ctx.runWorkflow("two-phase", task)` | Always sync |
| NEVER | `agents.fork()` or `agents.message()` | Breaks the chain |

## What NOT to Do

- ❌ `fork()` or `message()` inside a workflow — breaks context chain
- ❌ `message()` when you need the result — 30min delay
- ❌ `call()` from May's chat session for long tasks — blocks May
- ❌ Query context outside your tree — sessions are isolated between trees

## Relationship to Existing Systems

### finish() = turn complete
finish() signals the agent's turn is done. The infra handles session lifecycle based on autoClose policy. In a call tree, the caller gets the result. In a fork, the session archives. finish() data (deliverables, verification_evidence) flows into context queries.

### context.md = environmental knowledge
Loaded every session. Orthogonal to session context queries. context.md is "what you always need to know" (npx unavailable, project root is /app). Session context is "what happened in this specific work chain."

### Heartbeats = agent initiative
Heartbeats still exist for agents to find their own work (check request DB, review recent sessions, etc.). But active delegation uses fork/call, not heartbeat-driven message pickup.

## Evidence

### POC Results (2026-03-30)
Rich-context delegation: 47% fewer ops, 12% faster. Control tasks spent 2-4 ops on discovery. Treatment tasks went straight to the fix.

### What remains to test
1. Does `agents.context` query actually get used by agents? (vs ignoring it)
2. Does workflow context (sibling queries) help QA find more issues?
3. Does origin context help forked sessions avoid rediscovery?

## Implementation Phases

### Phase 1: Rename actions
- `agents.run` → `agents.fork` (carries originSessionId)
- `agents.send` → `agents.message`
- `agents.call` unchanged

### Phase 2: Context query
- Add `agents.context` action with scope: parent/origin/root/workflow
- Returns summarizeForHandoff + finish() structured data
- Access scoped to tree + origin

### Phase 3: Workflow context
- Workflow engine exposes completed steps to current step
- `scope: "workflow"` returns step summaries
