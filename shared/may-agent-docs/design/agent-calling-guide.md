# Agent Calling & Context Design

## Three Calling Patterns

| Action | Behavior | Session tree | Use when |
|--------|----------|-------------|----------|
| `call` | Sync, blocks, returns result | Child of caller (same root) | Need the result to continue |
| `fork` | Async, returns immediately | New independent root | Parallel work, May staying responsive |
| `message` | Fire-and-forget | No session until picked up | Background task, not urgent |

### Session Tree

```
call creates children under the same root:

  Root (May chat or forked session)
    ├── call("tech-lead", task)          ← child
    │     ├── call("coder", task)        ← grandchild
    │     └── call("qa", review)         ← grandchild
    └── call("coder", other-task)        ← child

fork creates a new root:

  Root A (May chat)
    └── fork("tech-lead", big-task)      ← returns sessionId, May continues

  Root B (forked, independent)           ← tech-lead's session, no parent
    ├── call("coder", task)
    └── call("qa", review)

message creates nothing:

  message("bob", "review this design")   ← stored in request DB
                                          ← bob picks up on next heartbeat
```

## Context Within a Call Tree

Every session in a call tree can see its relatives. This is the key benefit of `call` over `fork` — the context stays connected.

### What each session knows automatically

- **Its task** (the string passed by the caller)
- **Its parent session ID** (who called me)
- **Its workflow run ID** (if inside a workflow)
- **Its root session ID** (top of the tree)

### What each session can query

```
agents({ action: "context" })
  → parent session's handoff summary
  → files parent read, commands parent ran, errors parent saw

agents({ action: "context", sessionId: "<sibling>" })
  → specific session's handoff summary
  → e.g., QA queries coder's session to see what changed

agents({ action: "context", scope: "root" })
  → root session's task and summary
  → e.g., coder asks "what was the original human request?"
```

### What the summary contains

The handoff summary (already implemented as `summarizeForHandoff`):
- Files read and written
- Commands run and exit codes
- Errors encountered
- Agent's final response (truncated)

Not the raw transcript. Focused, bounded, useful.

### When to use context query

The caller should write a good task. The context query is for when the delegate needs MORE:
- Task says "fix the build" but doesn't mention which file → query parent to see what files parent read
- QA reviewing coder → query coder's session to see exact file changes
- Fix round → query QA's session to see specific findings
- Deep in a call chain → query root to recall the original human request

## Context Outside a Call Tree

### Fork
Forked sessions have no parent. They start from:
- The task string (from whoever called fork)
- context.md (environmental knowledge)
- Files on disk (tools)

No parent context to query. The task must be self-contained.

### Message
Messages have no session at all until picked up. The recipient gets:
- The message text (from request DB)
- context.md
- Their own heartbeat context

No tree to query. Pure fire-and-forget.

## Design Rules

1. **call is the default** — use it unless you have a reason not to
2. **fork is for May only** (or any human-facing agent) — to stay responsive
3. **message is for background work** — not time-sensitive, no result needed
4. **Context queries only work within a call tree** — fork/message start fresh
5. **The caller writes a good task** — context query supplements, doesn't replace
6. **Summaries, not transcripts** — agents get handoff summaries, never raw session data

## Implementation

### Phase 1: Rename + clarify (agent tool)
- `agents.run` → `agents.fork` (new root session, async)
- `agents.send` → `agents.message` (request DB, heartbeat pickup)
- `agents.call` stays as-is (sync, child session)
- Update all SOUL.md, context.md, heartbeat.md references

### Phase 2: Context query (agent tool)
- Add `agents.context` action
- Returns `summarizeForHandoff()` for the target session
- Default: parent session. Optional: any session in the same call tree.
- Reject queries outside the tree (fork/message sessions can't query the caller)

### Phase 3: Root context
- Add `scope: "root"` option to context query
- Returns the root session's task + summary
- Useful deep in call chains to recall the original intent
