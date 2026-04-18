# Fragility Audit: agents-auto-commit.ts Conflict Resolution

**File**: `agents/may/handlers/agents-auto-commit.ts` (709 lines)  
**Dates**: 2026-04-11 (initial), 2026-04-12 (follow-up)  
**Auditor**: tech-lead  

## Summary

The ownership-aware conflict resolution (added 2026-04-08) had **5 fragility patterns**, 2 of which could cause silent data loss. **3 critical fixes have been applied** (Fixes A, B, C below). Two lower-priority issues remain: no reentrancy guard (Finding 6) and no cleanup of conflict files (stale `.conflict-*` files).

**Current status (2026-04-12)**: Auto-commit runs every 10min. 986 runs, ZERO failures recorded. K3s remote fully in sync (0 commits divergence both directions). No `.conflict-*` files present. The "P1 data loss" on the dispatch board appears to be a **stale assessment** from before the fixes were applied.

### Fix Status
| Finding | Severity | Status |
|---------|----------|--------|
| F1: `instanceId="unknown"` drops files | HIGH | ✅ Fixed (line 355) |
| F2: Unbounded recursion | MEDIUM | ✅ Fixed (depth param, line 352-363) |
| F3: mergeAppendOnly duplicates | LOW | ✅ Fixed (Set dedup, line 550-551) |
| F4: Rebase→merge history bloat | LOW | By design (no fix needed) |
| F5: Rename parsing | LOW | Untriggered (no renames in practice) |
| F6: No reentrancy guard | MEDIUM | ❌ Not yet fixed — see below |

---

## Finding 1: `instanceId="unknown"` Silently Drops Local Ownership (SEVERITY: HIGH)

**Location**: `resolveConflicts()`, lines handling the ownership branch

**The bug**: When `detectInstance()` returns `"unknown"`:
- For a file owned by "local" → `owner !== instanceId` ("local" !== "unknown") AND `owner !== "shared"` → **keeps theirs**
- For a file owned by "k3s" → same logic → **keeps theirs**
- Result: ALL agent-owned files are treated as "the other side's" and our version is discarded

**When it triggers**: `detectInstance()` returns `"unknown"` when `localScore === k3sScore`. Currently this is `1 === 0` (only `may/cron.json` exists), so we get "local". But:
- If a k3s agent's cron.json is accidentally committed locally → scores could tie
- If may/cron.json is deleted or moved → both scores = 0 → `"unknown"`

**Impact**: Silent data loss of all local agent files during conflict resolution.

**Fix**: When instanceId is "unknown", skip ownership-based resolution entirely. Fall back to the safe "keep both" strategy for all files.

```typescript
// In resolveConflicts:
if (instanceId === "unknown") {
  log("[agents-auto-commit] ⚠️ unknown instance — skipping ownership resolution");
  return false; // let caller fall back to merge or retry
}
```

---

## Finding 2: Unbounded Recursive `resolveConflicts()` (SEVERITY: MEDIUM)

**Location**: `resolveConflicts()`, end of the function

```typescript
// Try resolving again recursively (rebase may have multiple steps)
return resolveConflicts(agentsDir, instanceId, config, log);
```

**The bug**: During a rebase, each commit may introduce conflicts. After resolving one commit's conflicts and calling `git rebase --continue`, the next commit may also conflict. The code calls itself recursively with no depth limit.

**When it triggers**: A rebase over N conflicting commits causes N levels of recursion. With 2-hour sync intervals and active k3s agents, 10-30 commits between syncs is common. If many conflict, we get deep recursion.

**Impact**: 
- Stack overflow is unlikely (Node default is ~10K frames), but 50+ recursive git operations is expensive
- If the rebase is fundamentally broken (e.g., corrupted index), infinite loop until timeout

**Fix**: Add a max depth parameter:

```typescript
function resolveConflicts(
  agentsDir: string,
  instanceId: "local" | "k3s" | "unknown",
  config: InstanceConfig,
  log: (msg: string) => void,
  depth: number = 0,
): boolean {
  if (depth > 50) {
    log("[agents-auto-commit] ⚠️ conflict resolution exceeded max depth (50)");
    return false;
  }
  // ... existing code ...
  return resolveConflicts(agentsDir, instanceId, config, log, depth + 1);
}
```

---

## Finding 3: `mergeAppendOnly()` Produces Duplicates (SEVERITY: LOW)

**Location**: `mergeAppendOnly()` function

**The bug**: When both sides add the same line, it appears twice in the output. The function filters against `baseLines` but doesn't deduplicate between `oursNew` and `theirsNew`.

Example:
- base: `"line1\n"`  
- ours: `"line1\nline2\n"`  
- theirs: `"line1\nline2\nline3\n"`  
- Result: `"line1\nline2\nline2\nline3\n"` — line2 duplicated

**When it triggers**: Both instances append the same entry to an INDEX.md or bulletin.md (e.g., both reference the same experiment).

**Impact**: Cosmetic — duplicated entries in append-only files. Not data loss, but messy.

**Fix**: Deduplicate `theirsNew` against `oursNew`:

```typescript
const oursNewSet = new Set(oursNew.map(l => l.trim()));
const uniqueTheirsNew = theirsNew.filter(l => !oursNewSet.has(l.trim()));
const additions = [...oursNew, ...uniqueTheirsNew].filter(Boolean);
```

---

## Finding 4: Rebase-to-Merge Fallback Creates History Bloat (SEVERITY: LOW)

**Evidence**: 23 merge commits in the last 100 commits. The rebase strategy fails frequently, falling through to `git merge`.

**The pattern**:
1. `git rebase remote/main` fails
2. `resolveConflicts()` tries to fix it
3. If that fails → `git rebase --abort`
4. `git merge remote/main` — creates a merge commit
5. If THAT also conflicts → resolveConflicts again
6. If that fails → `git merge --abort` — give up entirely

**Impact**: History is polluted with merge commits despite the stated goal of "keeps history linear." The rebase is more fragile than needed because:
- It rebases ALL local commits onto remote, not just new ones
- With many "chore(auto): commit before sync" commits, there are many potential conflict points

**Observation**: 8 "commit before sync" commits in the last 100 — these are pre-pull safety commits. They serve their purpose (preventing data loss) but create extra rebase work.

**Recommendation**: Not a code fix — this is working as designed (merge fallback is correct). But consider: if merge is the common outcome, skip the rebase attempt and just merge. Saves the overhead of rebase + abort.

---

## Finding 5: `git status --porcelain` Parsing Doesn't Handle Renames (SEVERITY: LOW)

**Location**: Main handler, porcelain parsing

```typescript
const changedFiles = status
  .split("\n")
  .map(line => line.slice(3).trim())
  .filter(f => f && !f.endsWith(".bak"));
```

**The bug**: Git porcelain format for renames is `R  old -> new`. The code would capture `"old -> new"` as a single filename, which would then fail file classification and git add.

**When it triggers**: Only if `git mv` is used in the agents repo (rare — agents typically create/modify files, not rename them).

**Impact**: That specific renamed file wouldn't be committed properly. Non-destructive — it'd stay uncommitted and get picked up next cycle.

---

## Finding 6: No Lock / Reentrancy Guard (SEVERITY: MEDIUM)

**Location**: Entire handler

**The scenario**: The handler runs every 2 hours via cron. But if the handler takes longer than expected (e.g., slow SSH, large rebase), the next invocation could start while the first is still running. Two simultaneous `git rebase` / `git add -A` / `git commit` operations on the same repo would corrupt git state.

**Current mitigation**: The 2-hour interval makes overlap unlikely given typical <30s runtime. But a hung SSH connection (timeout: 30s for push) combined with a slow rebase could push past expected runtime.

**Evidence**: The `git()` wrapper detaches stdin to prevent SIGTTIN freezes — this suggests network-related hangs have been a problem before.

**Fix**: Add a lockfile check at handler entry:

```typescript
const lockFile = join(agentsDir, ".git", "agents-auto-commit.lock");
// Check for stale lock (older than 5 minutes)
// Create lock at start, remove at end
```

---

## Proposed Fixes (within 20-line budget)

### Fix A: Guard against unknown instanceId (Critical — prevents silent data loss)

In `resolveConflicts()`, add early return when instanceId is unknown.

### Fix B: Add recursion depth limit

Add `depth` parameter to `resolveConflicts()` with max of 50.

### Fix C: Deduplicate mergeAppendOnly

Add a Set-based dedup of theirsNew against oursNew.

---

## Evidence from Production

| Signal | Count | Interpretation |
|--------|-------|----------------|
| Merge commits (last 100) | 23 | Rebase fails ~23% of the time |
| "commit before sync" | 8 | Pre-pull safety commits working as designed |
| `.conflict-*` files | 0 | Shared file conflicts are resolved or gitignored |
| k3s heartbeat | missing | k3s may not be actively syncing right now |
| Duplicate commit messages | Observed | `tech-lead: gitignore federation conflict artifacts` appears twice — evidence of rebase replaying commits |
