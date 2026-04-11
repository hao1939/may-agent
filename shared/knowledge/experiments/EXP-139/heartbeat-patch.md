# EXP-139: Optimizer Heartbeat Patch

**Purpose**: Deploy verify-wrap workflow as default dispatch for optimizer's forked work sessions.  
**Replaces**: Previous scout heartbeat patch (scout is no longer the target).

## Change 1: Add verify-wrap mandate before the fork template in Step 3

### Find this text (around line 56-70):
```
Fork template:
```javascript
agents.fork({
  agent: 'optimizer',
  task: `[WORK SESSION] <specific task>

Objective: <what does "done" look like?>
Hypothesis: <what I think will improve, and how to measure it>
Read: <specific files>

Deliverable: Write results to <specific file path>.`
})
```
```

### Replace with:
```
**For ALL forked work sessions, use `workflow.run('verify-wrap', task)` instead of `agents.fork()`. This catches verification gaps (FM-3.3) — your top error pattern. Do NOT use raw `agents.fork()` for work sessions.**

Fork template (uses verify-wrap):
```javascript
workflow.run("verify-wrap", `[WORK SESSION] <specific task>

Objective: <what does "done" look like?>
Hypothesis: <what I think will improve, and how to measure it>
Read: <specific files>

Deliverable: Write results to <specific file path>.`)
```
```

## Change 2: Update the workflow table to make verify-wrap the default

### Find this text (around line 48-55):
```
| Work type | Workflow | Why |
|-----------|----------|-----|
| Building a new tool/skill | `workflow.run('implement-and-verify', task)` | Catches forgotten compile/test |
| Investigation → written findings | `workflow.run('verify-wrap', task)` | Ensures findings actually get written |
| Multi-question analysis | `workflow.run('parallel-research', JSON.stringify({...}))` | Parallel > sequential |
```

### Replace with:
```
| Work type | Workflow | Why |
|-----------|----------|-----|
| Building a new tool/skill | `workflow.run('implement-and-verify', task)` | Catches forgotten compile/test |
| **All other forked work** | `workflow.run('verify-wrap', task)` | **Default.** Ensures verification of all written files (FM-3.3 fix) |
| Multi-question analysis | `workflow.run('parallel-research', JSON.stringify({...}))` | Parallel > sequential |
```

**Note**: The "Investigation → written findings" row is broadened to "All other forked work" to make verify-wrap the default for any work session that doesn't fit implement-and-verify or parallel-research. This aligns with EXP-028's finding that workflows must be the obvious default, not a situational choice.

## Rationale

- EXP-028 showed workflows with 0 heartbeat mentions get 0 usage
- Bob's deliver-or-report works because his heartbeat says "use workflow.run"
- Optimizer's FM-3.3 block rate is 67% — second-highest among all agents
- Optimizer already references verify-wrap but only for investigations — not as default
- verify-wrap is the minimum viable structural intervention
- Optimizer uses fork-based dispatch (unlike scout), so verify-wrap is architecturally compatible
