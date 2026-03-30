# Delegation Design

## Status: Ready for POC

## Core Principle

Agents are smart. Infra provides access, agents make decisions.

- Caller writes a good task — enough to start working
- Delegate works from the task — if it needs more, it pulls context on demand
- Infra makes context accessible — doesn't auto-attach, doesn't decide what's relevant

## The One Infra Gap

Today, a delegate session has:
- ✅ The task string (from caller)
- ✅ Full tool access (read files, run commands, query DB)
- ✅ context.md (environmental knowledge)
- ❌ **No access to what the caller already discovered**

The delegate can read any file. But it doesn't know WHICH files the caller read, what errors the caller saw, or what the caller already tried. That knowledge is in the parent session's transcript — inaccessible to the delegate.

## Proposed Solution: `agents({ action: "context" })`

One new action on the existing agents tool:

```typescript
// Get my parent session's summary (what the caller saw/did)
agents({ action: "context" })

// Get a specific session's summary (workflow sibling, previous attempt)
agents({ action: "context", sessionId: "s_XXX" })
```

Returns a handoff summary (already implemented as `summarizeForHandoff()`):
- Files read and written
- Commands run and their outcomes
- Errors encountered
- Agent's final response (truncated)

NOT the raw transcript. Focused, bounded, useful.

## Session Hierarchy

```
May (chat, long-lived)
  ├── agents.call("coder", task)
  │     coder has parentSessionId → can query May's context
  │
  └── workflow code-review-loop
        step 1: coder (workflowRunId=X) → can query May's context
        step 2: qa (workflowRunId=X) → can query coder's context (step 1)
        step 3: coder fix (workflowRunId=X) → can query qa's context (step 2)
```

Every session knows its parent (parentSessionId) and workflow (workflowRunId).
The `context` action walks these relationships.

## What This Enables

**Before**: QA gets "review the last commit." Reads random files. Says "looks good."

**After**: QA gets "review this implementation." If it needs more detail, calls `agents({ action: "context", sessionId: coderSessionId })` and sees exactly what coder changed, what commands coder ran, what coder verified. QA reviews the actual work.

**Before**: Coder fix task gets "fix these issues from QA" — a paste of QA's text output.

**After**: Coder fix gets the specific issues. If it needs the original context, calls `agents({ action: "context" })` and sees what the parent (or step 1) did.

## What This Does NOT Do

- Does not auto-attach context to delegations
- Does not replace good task descriptions
- Does not give raw transcripts (too large)
- Does not change how agents.call/send work
- Does not add new tools — extends existing agents tool

## Evidence-First Verification

### POC (before building)

1. Manually simulate: for 5 delegation tasks, append `summarizeForHandoff()` output from the parent session to the delegate's task. Measure: does the delegate use fewer ops? Does it find the right files faster?

2. If yes: build the `context` action (small change in manager-agents-tool.ts)

3. After building: run 5 real delegations where the delegate can use `agents({ action: "context" })`. Compare ops and outcome quality vs baseline.

### Success criteria

- Delegates use 20%+ fewer ops on context discovery
- OR delegates produce better results (fewer QA rejections)
- OR both

### Failure criteria

- Delegates ignore the context action (don't use it)
- OR context summaries are too noisy (agents get confused)
- If either: stop, don't deploy

## Infra Gap: Async Workflow Invocation

### Problem

Today workflows block the caller. If May runs `workflow code-review-loop`, she's frozen for 7-10 minutes. She can't respond to the human.

The alternative — `agents.send` through heartbeats — adds 30min latency.

### What's Needed

A way to start a workflow in the background, non-blocking:

```
workflow({ action: "start", name: "code-review-loop", task: "..." })
→ returns workflowRunId immediately, May continues
```

The workflow runs in its own execution context. May can check on it later:
```
workflow({ action: "status", workflowRunId: "wf_XXX" })
→ { status: "running", currentStep: "qa-round-1", ... }
```

Or get notified when done (via event/notification).

### This Unblocks

- May delegates via workflow without blocking
- Workflows run the coder→qa→fix loop at full speed (no heartbeat delays)
- May stays responsive to human input
- Multiple workflows can run in parallel

### POC Question

Before building: can we simulate this by having May call `agents.run("may", "workflow code-review-loop ...")` — spinning up a background May session that runs the workflow? Wasteful but tests the pattern without new infra.
