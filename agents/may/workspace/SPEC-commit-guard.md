# SPEC: finish() Commit Guard — Structural Enforcement for Agent Git Commits

**Author**: may  
**Date**: 2026-04-04  
**Status**: Ready for implementation  
**Assignee**: tech-lead (implementation), coach (measurement)

## Problem

74% of recent agents/ repo commits are low-quality auto-commits (`chore(auto): 8 agents, 49 files`). Root cause: agents don't commit their own work. Text rules in common-sense.md don't reliably change agent behavior (KE-002: knowledge ≠ behavior). We need L5 structural enforcement — the same level that already works for evidence validation (finish-guard.ts).

## Solution

A `beforeToolCall` guard on `finish()` that checks for uncommitted changes in the agent's workspace. If found, it blocks finish and tells the agent to commit. Same pattern as the existing finish-guard gates (FM-3.1, FM-3.3).

## Architecture

### Existing Pattern (follow exactly)

```
src/lib/tools/finish-guard.ts     — guards finish(success) for evidence
src/lib/tools/compose-guards.ts   — composes multiple guards into one
src/lib/manager.ts:352             — wiring: composeGuards(createEmptyArgsGuard(), createFinishGuard(), ...)
src/lib/manager-receipts.ts:167   — execution: guard runs before tool.execute()
```

### New File

```
src/lib/tools/commit-guard.ts
```

### Factory Signature

```typescript
export function createCommitGuard(
  agentName: string,
  projectRoot: string,
): (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>
```

The factory captures `agentName` and `projectRoot` as closure variables. This follows the same pattern as existing guards but with constructor args (which is fine — see how `createAgent()` already has `def.name` and `this._projectRoot` available).

### Wiring in manager.ts

```typescript
// Line ~352 in createAgent()
beforeToolCall: composeGuards(
  createEmptyArgsGuard(),
  createFinishGuard(),
  createCommitGuard(def.name, this._projectRoot),  // NEW
  createReadDedupGuard(),
  createSessionReadGuard(),
  createScrapeDedupGuard(),
),
```

Import: `import { createCommitGuard } from "./tools/commit-guard.js";`

## Guard Logic

### When to check

- Only intercept `finish()` calls (any status, not just success — agents should commit whether they succeeded or failed)
- Only check if `projectRoot` exists and `agents/` sub-repo exists (`<projectRoot>/agents/.git`)

### What to check

Run: `git -C <projectRoot>/agents status --porcelain -- <agentName>/`

This checks only the agent's own directory for uncommitted changes. We don't check `shared/` — that's a shared area and the auto-commit safety net handles it.

**Also check staged but uncommitted**: `git diff --cached` catches files that were `git add`'d but not committed.

### Scoping rules

Only block if the agent has **modified files it likely owns**:
- `agents/<agentName>/workspace/*` — always check
- `agents/<agentName>/context.md` — always check  
- `agents/<agentName>/heartbeat.md` — always check
- `agents/<agentName>/*.ts` — handler files, check
- `agents/shared/knowledge/*` — **DO NOT check** (auto-commit handles shared)
- `agents/shared/common-sense.md` — **DO NOT check** (human-controlled)

Simplification: just check `agents/<agentName>/` path prefix. If the agent modified shared files, the auto-commit safety net handles those.

### Block message

```
finish() blocked [uncommitted changes]: You have N uncommitted file(s) in agents/<agentName>/:
  M workspace/analysis.md
  A context.md
  ?? workspace/new-file.md

Commit them with a descriptive message before calling finish():
  cd /app/agents && git add <agentName>/ && git commit -m "<agentName>: <describe what you did>"

Good messages: "bob: H-045 Decision Topology hypothesis", "coach: new skill for evidence-first debugging"
Bad messages: "update files", "changes"

Then call finish() again.
```

### Edge Cases

1. **No changes**: Guard returns `undefined` (allow). Most sessions that only read won't trigger.
2. **Agent has no workspace dir**: Guard returns `undefined`. Some agents may not have agents/ dirs.
3. **git command fails**: Guard returns `undefined`. Guards are fail-open (existing pattern in manager-receipts.ts line 200: "guard errors are non-fatal").
4. **Agent is "may" checking shared files**: Scoped to `agents/may/` only. May's changes to shared/ are handled by auto-commit.
5. **`--no-verify` bypass**: Auto-commit handler already uses `--no-verify`. This guard is in the tool layer, not git hooks, so no conflict.
6. **Agent keeps calling finish without committing**: The guard blocks every time. Eventually the agent hits maxTurns and gets interrupted. The auto-commit safety net sweeps up. This is acceptable degradation.
7. **Chat sessions / non-agent contexts**: Check if agentName is truthy and agents dir exists. Skip guard for chat sessions.

### Timeout

`git status` should complete in <100ms. Set a 5s timeout on the exec. If it times out, allow finish (fail-open).

## Testing

### Unit test: `test/commit-guard.test.ts`

1. **No uncommitted changes → allows finish**: Mock git status returning empty. Verify guard returns undefined.
2. **Uncommitted changes → blocks finish**: Mock git status returning `M workspace/file.md`. Verify guard returns `{ block: true, reason: ... }`.
3. **Non-finish tool → allows**: Call guard with tool name "read". Verify returns undefined.
4. **Git command fails → allows finish (fail-open)**: Mock git throwing error. Verify returns undefined.
5. **No agents dir → allows finish**: Set projectRoot to nonexistent path. Verify returns undefined.
6. **Empty agent name → allows finish**: Pass empty string for agentName. Verify returns undefined.

### Integration verification

After deployment, the coach measurement phase will compare commit ratios.

## Coach Task: Measurement

After tech-lead deploys the guard:

1. **Baseline** (already available): Run `cd /app/agents && git log --oneline -100 | grep -c 'chore(auto)'` — currently ~62%.
2. **Wait 48h** for agents to cycle through sessions with the new guard.
3. **Measure**: Same command. Target: auto-commits drop below 30% of recent commits.
4. **Quality check**: Sample 10 agent commits (non-auto). Verify messages are descriptive (agent name prefix, describes what changed).
5. **Report**: Write results to `agents/coach/workspace/EXP-commit-guard-results.md`.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/tools/commit-guard.ts` | CREATE — the guard implementation |
| `src/lib/manager.ts` | MODIFY — add import and wire into composeGuards |
| `test/commit-guard.test.ts` | CREATE — unit tests |

## Risks

- **Performance**: `git status` on agents/ takes ~20ms (small repo). Negligible.
- **False blocks**: Agent modifies file, commits it, but git status still shows changes from a different file in their dir that someone else modified. Unlikely — each agent only writes to its own dir.
- **Infinite loop**: Agent can't figure out how to commit. Mitigated: maxTurns interrupt + auto-commit safety net. The block message includes the exact command to run.
