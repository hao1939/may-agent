# Design: Persistent-Task File Structure

## Problem

The project file serves three purposes that conflict:
1. **Project spec** — goal, milestones, status (needs stability)
2. **Iteration log** — worker results, reviewer assessments (grows, append-only)
3. **Comments** — external feedback from human/agents (must not be overwritten)

Workers overwrite the file when editing it, dropping comments and previous content.

## Solution: Three Files

```
agents/<owner>/workspace/projects/<name>/
  project.md      — the spec (goal, milestones, status)
  log.md           — iteration history (append-only)
  comments.md      — external feedback (append-only)
```

### project.md (the spec)

**Read by:** worker, reviewer, orchestrator, anyone
**Written by:** orchestrator (status, iteration, current state), owner agent (milestones, goal — during planning), human (goal changes, priority)
**Append/overwrite:** overwrite by orchestrator for status fields; owner and human edit milestones and goal directly

### log.md (iteration history)

**Read by:** worker (last 3 entries), reviewer, anyone
**Written by:** orchestrator only (appends after each worker/reviewer phase)
**Append/overwrite:** append only — never rewrite, only prune old entries by collapsing

### comments.md (external feedback)

**Read by:** worker (at start of each iteration), owner, anyone
**Written by:** human (Hao), May, other agents — anyone with feedback
**Append/overwrite:** append only — never delete or rewrite others' comments. Owner reads and uses judgment.

## Changes to persistent-task.ts

### Input format
```
project: agents/optimizer/workspace/projects/workflow-first
```
Note: directory path, not file path. The workflow reads project.md, log.md, comments.md from this directory.

### Worker prompt includes:
1. Goal + milestones + current state (from project.md)
2. Last 3 iteration summaries (from log.md)
3. Comments (from comments.md)
4. Owner guidance from last review
5. "What You Must Produce" expectations

### Worker CANNOT edit:
- project.md (orchestrator and owner/human manage it)
- log.md (orchestrator manages it)
- comments.md (external feedback, append-only by others)

### Worker CAN:
- Read any file
- Create/edit files in workspace (deliverables, findings, etc.)
- Run commands, queries, tools
- Call finish() with results

### Orchestrator handles:
- Reads worker result → appends to log.md
- Reads reviewer assessment → appends to log.md  
- Updates project.md status, iteration count, current state
- Prunes old log entries (collapse old iterations)

## Migration

Existing project files (single .md) continue to work. The workflow detects:
- If input points to a directory with project.md → new format
- If input points to a .md file → legacy format (current behavior)

New projects should use the directory format.

## Benefits

1. **No overwrites** — each file has one writer (or append-only)
2. **Comments survive** — separate file, nobody rewrites it
3. **Worker can't corrupt the spec** — project.md is orchestrator-managed
4. **Clean separation** — spec vs history vs feedback
