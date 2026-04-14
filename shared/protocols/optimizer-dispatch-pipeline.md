# Optimizer Dispatch Pipeline

**Status**: Active  
**Date**: 2026-04-13  
**Problem**: 51% of optimizer findings never get deployed. The gap between "finding written" and "fix dispatched" has too many manual steps.

## The Problem

The optimizer produces ~5-10 findings per day. Each finding identifies a problem, proposes a fix, and cites evidence. But findings are passive files — no one scans them unless they happen to read the workspace. The result: valuable analysis rots in `agents/optimizer/workspace/finding-*.md`.

Current flow:
```
Optimizer analyzes → writes finding-*.md → ... → nobody reads it → finding dies
```

The heartbeat already has a "Finding Conversion" section telling the optimizer to dispatch fixes inline. But this adds ops to work sessions and competes with analysis work. It also doesn't work for findings that need a different agent to implement.

## The Solution: DISPATCH-READY.md

A lightweight drop file that bridges findings to action.

New flow:
```
Optimizer analyzes → writes finding-*.md → writes DISPATCH-READY.md → May scans → May dispatches
```

### How It Works

1. **Optimizer writes DISPATCH-READY.md** when a finding is actionable — meaning it has a specific file to change, a specific change to make, and evidence that the change will help.

2. **May's heartbeat scans** for `agents/optimizer/workspace/DISPATCH-READY.md` on each cycle. If present, May reads it and dispatches the recommended action (usually via tech-lead or coder).

3. **After dispatch**, May renames the file to `DISPATCH-READY-DONE-<date>.md` (or deletes it). The optimizer sees it's gone on next heartbeat and knows the finding was picked up.

### When to Write DISPATCH-READY.md

Write it when ALL of these are true:
- The finding has a **specific target** (file path, agent, config)
- The fix is **concrete** (not "investigate further" or "consider changing")
- There's **evidence** the fix will help (data, measurements, prior experiments)
- The fix is **implementable by another agent** (not something only a human can decide)

Do NOT write it when:
- The finding is observational (no clear action)
- The fix requires human judgment or policy decisions (→ use escalation protocol instead)
- The fix is something the optimizer can do inline in <3 ops (just do it)
- A DISPATCH-READY.md already exists (one at a time — don't overwrite)

### File Format

The file lives at: `agents/optimizer/workspace/DISPATCH-READY.md`

Use the template at `agents/shared/protocols/DISPATCH-READY-TEMPLATE.md`. The key fields:

| Field | Purpose |
|-------|---------|
| **Finding** | Which finding file this comes from |
| **Summary** | 1-2 sentence problem description |
| **Recommended Action** | The specific change to make |
| **Target Agent** | Who should implement (tech-lead, coder, etc.) |
| **Target File(s)** | Exact file paths to modify |
| **Priority** | P0 (blocking), P1 (important), P2 (nice-to-have) |
| **Evidence** | Data supporting the fix |
| **Verification** | How to confirm the fix worked |

### One At a Time

Only one `DISPATCH-READY.md` should exist at a time. This keeps the queue simple and prevents overload. If the optimizer has multiple actionable findings, dispatch the highest-priority one first. Queue the rest in `todo.md` and dispatch them as previous ones clear.

### What May Does With It

May's responsibility (handled separately):
1. Read `DISPATCH-READY.md`
2. Validate the recommendation makes sense
3. Dispatch to the target agent (fork or message)
4. Clean up the file
5. If the recommendation doesn't make sense → delete the file and optionally message optimizer with feedback

### Failure Modes and Mitigations

| Failure | Mitigation |
|---------|-----------|
| DISPATCH-READY.md sits unread for hours | May scans every heartbeat; staleness check: if file is >6h old, it's a May heartbeat bug |
| Optimizer writes vague/unactionable dispatches | Template enforces specificity; May validates before dispatching |
| Queue backs up (optimizer produces faster than May dispatches) | One-at-a-time rule; optimizer queues extras in todo.md |
| May dispatches but fix fails | Standard fix workflow handles this; optimizer measures in next analysis cycle |

## Relationship to Existing Patterns

This complements (not replaces) the existing "Finding Conversion" section in the optimizer heartbeat. That section handles same-session dispatch (optimizer forks tech-lead directly). DISPATCH-READY.md handles cross-cycle dispatch (finding written now, dispatched on May's next heartbeat).

```
Same-session actionable finding → fork tech-lead inline (existing pattern)
Cross-cycle actionable finding  → write DISPATCH-READY.md (this protocol)
Observational finding           → write to finding-*.md only (no dispatch)
Policy/design question          → escalation protocol
```
