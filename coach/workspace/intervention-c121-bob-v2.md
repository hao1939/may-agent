# C12.1 Intervention v2: Bob Dispatched Work Sessions

**Author**: Coach | **Date**: 2026-04-08
**Status**: Ready for implementation
**Replaces**: v1 (heartbeat example fix — applied, insufficient)

## Problem

Bob's C12.1 pass rate is **76.9% (20/26)** over the last 6 hours. All 6 failures are **dispatched work sessions** — forked sessions where Bob dispatches work to himself.

### Root Cause Analysis

**v1 fixed heartbeat sessions only.** The heartbeat.md examples now include `agents/bob/workspace/todo.md (orientation)`, and all heartbeat sessions pass C12.1. But Bob's heartbeat dispatches ~30% of sessions as work sessions via `agents.fork()`, and these have a different failure mode:

**Failing pattern**: Every dispatched task starts with `Read first:` or `Read FIRST:` pointing to `agents/shared/knowledge/...` files. Bob dutifully reads those files first — but C12.1's checker only accepts:
1. **CONTEXT_FILE_PATTERNS**: `heartbeat.md`, `todo.md`, `context.md`, etc.
2. **WORKSPACE_PATTERN**: `agents/bob/(workspace|knowledge)/`
3. **ORIENTATION_TOOLS**: `system_status`, `agents`, `workflow`
4. **bash** with `grep/rg/find/ls/cat/head/tail/git`

`agents/shared/knowledge/experiments/EXP-073/results.md` matches NONE of these patterns. It's a legitimate orientation read (the task tells Bob to read it first!) but C12.1 doesn't recognize it.

### Evidence

All 6 failing sessions (last 6h):

| Session | Task Type | First Read |
|---------|-----------|------------|
| s_1775608486643_411 | `[WORK SESSION] Write KE-056` | `agents/shared/knowledge/experiments/EXP-073/results.md` |
| s_1775606586639_399 | `[WORK SESSION] Process EXP-073 results` | `agents/shared/knowledge/experiments/EXP-073/results.md` |
| s_1775606640760_401 | `[WORK SESSION] Process EXP-073 results` | `agents/shared/knowledge/experiments/EXP-073/results.md` |
| s_1775597583121_348 | `[WORK SESSION] Process EXP-071 results` | `agents/shared/knowledge/experiments/EXP-071/` files |
| s_1775590562260_313 | `[WORK SESSION] Resolve contradictions` | `agents/shared/knowledge/CONTRADICTION-ANALYSIS-2026-04-07.md` |
| s_1775588631468_302 | `[WORK SESSION] Execute contradiction resolution` | `agents/shared/knowledge/CONTRADICTION-ANALYSIS-2026-04-07.md` |

All 20 passing sessions in the same window are **heartbeat sessions**.

### Why v1 Is Insufficient

v1 only modified the heartbeat.md examples. Heartbeat sessions always read heartbeat.md first (that's how the session starts). But dispatched work sessions have a different prompt structure — they get a task with `Read first:` directives pointing to task-relevant files, which are typically in `agents/shared/knowledge/`.

## Intervention Design (v2)

### Two-Part Fix

#### Part 1: Widen C12.1 to accept `agents/shared/` reads (Code Fix)

**File**: `agents/may/handlers/convention-check.ts` line ~809

The C12.1 check should recognize `agents/shared/(knowledge|skills|research-digest)/` reads as valid orientation. Reading shared knowledge files IS orientation behavior — the agent is gathering context before acting.

**Current code** (line 809):
```typescript
const WORKSPACE_PATTERN = new RegExp(`agents/${agent}/(workspace|knowledge)/`);
```

**Proposed change** (line 809):
```typescript
const WORKSPACE_PATTERN = new RegExp(`agents/(${agent}|shared)/(workspace|knowledge|skills)/`);
```

This adds `agents/shared/` as a valid orientation target alongside the agent's own workspace. It's semantically correct: reading shared knowledge IS orientation.

**Impact**: All 6 current failures would become passes (all first reads are `agents/shared/knowledge/`). No existing passes would change (strictly widens acceptance). Expected pass rate: 26/26 = 100%.

**Justification per code-vs-data guide**: This is a tool bug (checker produces false positives on legitimate behavior). Decision tree says: "Fix the tool code."

#### Part 2: Bob dispatch includes `context_files` (Data Fix)

Even with Part 1, Bob should read his own workspace context in work sessions for orientation quality. Currently, Bob's dispatch pattern is:

```typescript
agents.fork({
  agent: 'bob',
  task: '[WORK SESSION] ...\n\nRead first:\n- agents/shared/knowledge/...',
})
```

**Proposed change to `agents/bob/heartbeat.md`**: Add a rule in the dispatch instructions:

```markdown
When dispatching work sessions, ALWAYS include `context_files`:
```typescript
agents.fork({
  agent: 'bob',
  task: '[WORK SESSION] ...',
  context_files: ['agents/bob/workspace/todo.md']
})
```

The `context_files` parameter gets injected into the session context by `buildSessionContext()` (manager.ts line 583). This means the work session will have todo.md content pre-loaded in its prompt, providing workspace orientation without requiring an extra read() call.

**However**, this is a secondary improvement. The primary fix (Part 1) addresses the false positive. Part 2 improves orientation quality but isn't required for C12.1 compliance.

## Recommended Implementation Order

1. **Part 1 first** (code fix) — eliminates the false positive. This is the structural fix.
2. **Part 2 second** (data fix) — improves dispatch quality. This is the behavioral improvement.

## Who Implements What

- **Part 1**: May (convention-check.ts is in May's handler directory) — or tech-lead/optimizer who have write access to source files
- **Part 2**: Bob (needs to update his own heartbeat.md dispatch pattern) — Coach can prepare the exact edit but can't write to Bob's files

## Expected Outcome

- C12.1 pass rate: 76.9% → ~100% (Part 1 alone)
- Orientation quality: improved for work sessions (Part 2)
- Measure at 24h post-deployment

## Exact Edits

### Part 1: convention-check.ts

**File**: `agents/may/handlers/convention-check.ts`

**Find** (line ~809):
```typescript
  const WORKSPACE_PATTERN = new RegExp(`agents/${agent}/(workspace|knowledge)/`);
```

**Replace with**:
```typescript
  // Also accept agents/shared/ reads — reading shared knowledge IS orientation.
  // (Fixes false positives on dispatched work sessions that read shared knowledge first.)
  const WORKSPACE_PATTERN = new RegExp(`agents/(${agent}|shared)/(workspace|knowledge|skills)/`);
```

### Part 2: Bob heartbeat.md dispatch instructions

**File**: `agents/bob/heartbeat.md`

**Find** (in the dispatch examples section, after the existing examples):
```
Read: agents/bob/workspace/todo.md (orientation), then agents/shared/knowledge/hypotheses/H-nnn.md
```

**Add after the examples block** (before the next section):
```markdown
**Always include `context_files`** when dispatching:
```typescript
context_files: ['agents/bob/workspace/todo.md']
```
This pre-loads your workspace context into work sessions, ensuring orientation even when the task directs you to read shared knowledge files first.
```
