# Design: Persistent-Task File Structure (v2)

## Two Files Per Project

```
agents/<owner>/workspace/projects/<name>/
  project.md   — the project document (goal, milestones, state, comments)
  journal.md   — iteration log (raw process history)
```

### project.md — The Project Document

Contains everything about WHAT the project is and WHERE it stands:

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
Audit complete. Freestyle pattern analysis done. Next: build review-output workflow.

## Iteration Summary
- **Iter 1-8**: Audited workflows, built measurement tool, categorized keep/review/remove
- **Iter 9-15**: Identified freestyle patterns, created finding doc
- **Iter 16-20**: Cleaned up project file, removed dead refs

## Comments
- [2026-04-19 hao] Don't delete dead workflows. Archive or fix adoption.
- [2026-04-19 hao] Close the loop — measure, identify, fix, measure again.
```

**Who reads:** worker, reviewer, orchestrator, anyone
**Who writes:**
- Orchestrator: updates `**Status**`, `**Iteration**`, `## Current State`, appends to `## Iteration Summary` — field-level updates only, never rewrites the whole file
- Owner/human: edits `## Goal`, `## Milestones`, `## Comments`
- Worker: READS ONLY — never writes to project.md

### journal.md — The Process Log

Raw append-only log of every iteration:

```markdown
# Journal

### Iteration 20 — 2026-04-19T16:01Z
**Worker**: Fixed project file. 39 lines clean.
**Reviewer**: CONTINUE — move to actual work.

### Iteration 19 — 2026-04-19T16:01Z  
**Worker**: Created freestyle-patterns finding. Identified review-output as top candidate.
**Reviewer**: CONTINUE — good analysis.
```

**Who reads:** worker (last 3 entries for context), reviewer, anyone
**Who writes:** orchestrator only — appends after each worker/reviewer phase
**Mode:** append only, never overwrite. Old entries pruned by collapsing.

## Orchestrator Rules (persistent-task.ts)

### Writing to project.md — FIELD-LEVEL UPDATES ONLY

The orchestrator uses targeted updates, not full file rewrites:

```typescript
// GOOD: update specific fields
content = updateField(content, "Status", "active");
content = updateField(content, "Iteration", String(iteration));
content = updateSection(content, "Current State", newStateSummary);
content = appendToSection(content, "Iteration Summary", `- **Iter ${iteration}**: ${brief}`);

// BAD: rewrite the whole file
writeFileSync(path, entireNewContent); // ← NEVER DO THIS
```

Functions needed:
- `updateField(content, field, value)` — already exists, replaces `**Field**: value`
- `updateSection(content, heading, newContent)` — replaces content under `## Heading`
- `appendToSection(content, heading, line)` — appends a line under `## Heading`

### Writing to journal.md — APPEND ONLY

```typescript
// Always append, never read-modify-write the whole file
appendFileSync(journalPath, iterationBlock);
```

### Worker prompt includes:
1. Goal + milestones from project.md
2. Current state from project.md
3. Last 3 iterations from journal.md
4. Comments from project.md
5. Owner guidance from last reviewer entry in journal.md
6. "You CANNOT edit project.md or journal.md. Produce deliverables in workspace."

## Migration

- If project path is a directory with project.md → new format
- If project path is a .md file → legacy single-file format
- New projects use directory format

## No Override Rules

| Content | Who can change | How |
|---------|---------------|-----|
| Goal | Owner, human | Direct edit |
| Milestones | Owner, human | Direct edit (check off / add) |
| Status | Orchestrator | Field-level update |
| Iteration count | Orchestrator | Field-level update |
| Current State | Orchestrator | Section replace |
| Iteration Summary | Orchestrator | Section append |
| Comments | Human, May, agents | Section append |
| Journal entries | Orchestrator | File append |
| Worker | NOTHING in project.md or journal.md | Produces deliverables elsewhere |
