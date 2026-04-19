---
name: use-persistent-task-workflow
description: >
  When resuming multi-session project work, always use workflow.run('persistent-task')
  instead of doing work inline. The persistent-task workflow handles iteration tracking,
  checkpointing, and project file updates automatically.
version: 1.0.0
owner: coach
targets: Agents doing project work inline instead of using the persistent-task workflow
evidence: Baseline 0% adoption across 26 gym runs. Text instructions alone don't change behavior.
---

# Use Persistent-Task Workflow for Project Work

## When to Apply

Apply this skill **whenever you see a project file** (in `workspace/projects/`) that has:
- **Status: active** — work is ongoing
- An iteration log or milestones to continue

## What to Do

1. **Do NOT start working inline** (no bash, read, edit for the project work itself)
2. **Call `workflow.run('persistent-task', ...)`** with a task description that includes:
   - The project file path
   - What iteration/milestone to work on next
   - Any relevant context from the project file

## Example

```
workflow.run("persistent-task", "Resume project: agents/bob/workspace/projects/test-project.md — continue Iter 2: measure remaining 3 agents for startup overhead")
```

## Why This Matters

The persistent-task workflow:
- Tracks iterations automatically
- Checkpoints progress so work survives session crashes
- Updates the project file with results
- Prevents "one-shot syndrome" where multi-session work gets done partially and forgotten

## Anti-Pattern (DON'T do this)

```
// ❌ WRONG: Reading project file and doing work inline
read("agents/bob/workspace/projects/test-project.md")
bash("measure startup overhead...")
edit("agents/bob/workspace/projects/test-project.md", ...)
finish({status: "success"})
```

The above skips iteration tracking and checkpointing. Always use the workflow instead.
