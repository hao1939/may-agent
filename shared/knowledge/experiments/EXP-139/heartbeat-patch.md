# EXP-139: Scout Heartbeat Patch

**Purpose**: Deploy verify-wrap workflow as default dispatch for scout work sessions.

## Change 1: Replace dispatch template in Step 3

### Find this text (around line 68-80):
```
For each substantive task, fork a work session **with a workflow**:

```javascript
agents.call({
  action: 'fork',
  agent: 'scout',
  task: `[WORK SESSION] <specific task description>

Objective: <one sentence — what does "done" look like?>
Read: <specific files to read for context>
Output: <specific file path for deliverable>

Sources to check: <arXiv cs.MA, cs.AI, HN, GitHub trending, etc.>
Constraints:
- For every edit(): read() the file first, then edit() using exact text
- For every write(): read() the file back to verify
- Write findings as you go, not at the end`
})
```
```

### Replace with:
```
**For ALL work sessions, use `workflow.run('verify-wrap', task)` to get structural verification. This catches verification gaps (FM-3.3) — your top error pattern. Do NOT use raw `agents.call({action: 'fork'})` for work sessions.**

For each substantive task, dispatch through verify-wrap:

```javascript
workflow.run("verify-wrap", `[WORK SESSION] <specific task description>

Objective: <one sentence — what does "done" look like?>
Read: <specific files to read for context>
Output: <specific file path for deliverable>

Sources to check: <arXiv cs.MA, cs.AI, HN, GitHub trending, etc.>
Constraints:
- For every edit(): read() the file first, then edit() using exact text
- Write findings as you go, not at the end`)
```
```

**Note**: The "For every write(): read() the file back to verify" constraint is intentionally removed — verify-wrap Phase 2 handles this structurally.

## Change 2: Remove redundant verification lines from examples

In each of the scout work session examples (Daily arXiv triage, Weekend synthesis, Targeted research, Deep dive enrichment, Hypothesis writing), remove the line:
```
- For every write(): read() the file back to verify
```

This is now handled by verify-wrap Phase 2. Keep the "For every edit(): read() the file first, then edit() using exact text" line — that's about correct edit() usage, not verification.

## Rationale

- EXP-028 showed workflows with 0 heartbeat mentions get 0 usage
- Bob's deliver-or-report works because his heartbeat says "use workflow.run"
- Scout's FM-3.3 block rate is 71% — highest among all agents
- verify-wrap is the minimum viable structural intervention
