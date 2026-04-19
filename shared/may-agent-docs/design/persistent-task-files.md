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

### project.md (read by worker, written by orchestrator only)

```markdown
# Project: Workflow-First Culture

**Status**: active
**Owner**: optimizer
**Iteration**: 20

## Goal
Make workflows the default way agents work.

## Milestones
- [x] Audit existing workflows
- [ ] Build review-output workflow
- [ ] Increase coverage from 31% to 80%

## Current State
Audit complete. Top freestyle pattern identified. Next: build new workflow.
```

**Who writes:** Only the persistent-task orchestrator updates status, iteration count, current state.
**Who reads:** Worker reads it to know the goal, milestones, current state.
**Worker CANNOT edit this file.** Worker produces output in its own session. Orchestrator records the summary to log.md.

### log.md (append-only by orchestrator)

```markdown
# Iteration Log

### Iteration 20 — 2026-04-19T16:01Z
**Worker result**: Fixed workflow-first.md. 39 lines clean.
**Owner assessment**: CONTINUE — move to actual work, remove dead refs.

### Iteration 19 — 2026-04-19T16:01Z
**Worker result**: Created freestyle-patterns finding. Identified review-output as top candidate.
**Owner assessment**: CONTINUE — good analysis, fix the bloated project file.
```

**Who writes:** Only the persistent-task orchestrator appends entries.
**Who reads:** Worker sees last 3 entries in its prompt for context.

### comments.md (append-only by anyone)

```markdown
# Comments

- [2026-04-19 hao] Don't delete dead workflows. Archive or fix adoption.
- [2026-04-19 hao] Optimizer must close the loop, not just measure.
- [2026-04-19 may] Consider coach's growth-cycle as model for new workflows.
```

**Who writes:** Anyone appends. Nobody overwrites.
**Who reads:** Worker sees comments in its prompt at the start of each iteration.

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

### Worker CANNOT:
- Edit project.md (orchestrator does it)
- Edit log.md (orchestrator does it)
- Edit comments.md (external only)

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
