# Complexity Audit: agents-auto-commit.ts Sync Flow

**File**: `agents/may/handlers/agents-auto-commit.ts` (488 LOC)  
**Shell script**: `scripts/auto-commit-agents.sh` (32 LOC, appears to be the old dumb version — still on disk)  
**Date**: 2026-04-14  
**Lens**: End-to-end flow complexity — layers, I/O ops, conditional branches, indirection, fragile ordering  

---

## End-to-End Flow (timer fires → done)

```
create() returns async closure
  │
  ├─1. getRemote(agentsDir)              [I/O: git remote]
  ├─2. loadInstanceConfig(agentsDir)      [I/O: readFileSync federation/instance-config.json]
  ├─3. detectInstance(agentsDir, config)  [I/O: N×existsSync for cron.json per agent (up to 14)]
  ├─4. writeInstanceHeartbeat(...)        [I/O: mkdirSync + writeFileSync heartbeat JSON]
  │
  ├─5. tryPull(remote, ...)              ← COMPLEX SUBTREE (see below)
  │
  ├─6. git status --porcelain            [I/O: git status]
  ├─7. Parse changed files → groupByAgent → classify
  ├─8. Branch: groups.length ≤ 2?
  │     ├─ YES: per-agent loop
  │     │    ├─ git add per file         [I/O: N×git add]
  │     │    ├─ git diff --cached        [I/O: git diff]
  │     │    └─ gitCommit()              [I/O: writeFileSync + git commit + unlinkSync]
  │     └─ NO: batch
  │          ├─ git add -A               [I/O: git add]
  │          └─ gitCommit()              [I/O: writeFileSync + git commit + unlinkSync]
  │
  └─9. tryPush(remote, ...)              [I/O: git push]
```

### tryPull() subtree (the complex part):

```
tryPull()
  ├─ git fetch remote main               [I/O: network + git]
  ├─ git rev-list --count HEAD..remote    [I/O: git]
  ├─ Branch: behind === "0"? → early return
  ├─ git status --porcelain               [I/O: git]
  ├─ Branch: hasChanges?
  │    ├─ git add -A                      [I/O: git]
  │    └─ git commit "before sync"        [I/O: git]
  │
  ├─ TRY: git rebase remote/main         [I/O: git rebase]
  │    ├─ SUCCESS → done
  │    └─ FAILURE → resolveConflicts()    ← RECURSIVE (depth ≤50)
  │         ├─ git diff --name-only -U    [I/O: git]
  │         ├─ For each conflicted file:
  │         │    ├─ getFileOwner()        [pure: string match]
  │         │    ├─ Branch: owner === us → git checkout --ours + git add  [2×I/O]
  │         │    ├─ Branch: owner === them → git checkout --theirs + git add [2×I/O]
  │         │    └─ Branch: shared → resolveSharedConflict()
  │         │         ├─ git show :2:file  [I/O]
  │         │         ├─ git show :3:file  [I/O]
  │         │         ├─ Branch: identical → writeFileSync + git add
  │         │         ├─ Branch: append-only → mergeAppendOnly() + writeFileSync + git add
  │         │         └─ Branch: else → writeFileSync×2 + git add (keep both as .conflict-*)
  │         │
  │         ├─ Branch: existsSync(.git/rebase-merge | rebase-apply)?
  │         │    ├─ YES → git rebase --continue  [I/O]
  │         │    └─ NO → git commit --no-edit     [I/O]
  │         └─ CATCH → recurse resolveConflicts(depth+1)
  │
  └─ REBASE FAILED entirely:
       ├─ git rebase --abort              [I/O]
       ├─ TRY: git merge remote/main      [I/O]
       │    ├─ SUCCESS → done
       │    └─ FAILURE → resolveConflicts() again (same recursive tree)
       │         ├─ SUCCESS → done
       │         └─ FAILURE → git merge --abort [I/O]
       └─ CATCH → log + move on
```

---

## Metrics

| Metric | Count |
|--------|-------|
| **Named functions** | 18 |
| **Total conditional branches** | ~32 (if/else, try/catch, ternary) |
| **I/O operations (happy path, no conflicts)** | 10-12 (git remote, readFile config, N×existsSync, writeFile heartbeat, git fetch, git rev-list, git status, git rebase, git status, git add, git commit, git push) |
| **I/O operations (worst case, shared conflicts during rebase)** | 50+ (recursive conflict resolution × depth 50, each doing git show×2, writeFile, git add, git rebase --continue) |
| **Maximum recursion depth** | 50 (resolveConflicts) |
| **Layers of fallback** | 3 (rebase → resolve conflicts → abort + merge → resolve conflicts → abort) |
| **Lines of code** | 488 |

---

## Findings

### F1: Dead shell script still on disk
`scripts/auto-commit-agents.sh` (32 LOC) is the old "dumb" auto-commit. The TS handler's header comments reference it explicitly ("Unlike the old dumb handler"). It should be deleted or at minimum marked deprecated — if someone cron-schedules it independently, it will race with the TS handler and produce garbage commits.

**Severity**: Low (inert) | **Fix**: Delete the file or add a `# DEPRECATED` header.

### F2: Recursive conflict resolution is overengineered
`resolveConflicts()` recurses up to depth 50 to handle multi-step rebase conflicts. Each recursion re-runs `git diff --name-only --diff-filter=U` and processes all conflicted files. In the worst case this is **O(50 × files × 3 git ops per file)** — potentially 100+ git subprocess spawns in a single handler invocation.

The recursion exists because `git rebase --continue` may hit another conflict on the next commit. But depth 50 is excessive — if there are >5 conflicting rebase steps, the history is diverged enough that a merge is the right answer anyway.

**Severity**: Medium (performance / potential timeout) | **Fix**: Lower max depth to 5, or switch to `--abort` + merge after first conflict resolution attempt.

### F3: Commit-before-pull creates noise commits
In `tryPull()`, any dirty state triggers `git commit -m "chore(auto): commit before sync"` before rebase. This ensures no data loss, but creates vacuous commits that pollute history. If the next step (rebase) succeeds cleanly, this temporary commit stays in history.

**Severity**: Low (cosmetic) | **Fix**: Consider `git stash` + `git stash pop` instead, which is cleaner when the rebase succeeds. Only commit if stash pop fails.

### F4: Instance detection via cron.json heuristic is fragile
`detectInstance()` counts how many cron.json files match each instance's expected agent list. This fails if:
- An agent is temporarily disabled (cron.json removed)
- A new agent is added but not listed in instance-config.json
- Both instances happen to have equal cron.json counts → returns "unknown" → **all conflict resolution is skipped**

**Severity**: Medium (silent degradation) | **Fix**: Write instance identity explicitly (e.g., a `.instance-id` file) rather than inferring it from agent presence.

### F5: Shared conflict resolution can create orphan .conflict-* files
When a shared file has a non-append-only conflict, the handler writes `{file}.conflict-{otherInstance}`. These are committed and pushed but **nothing ever cleans them up**. Over time the repo accumulates `.conflict-local` and `.conflict-k3s` files that nobody reads.

**Severity**: Medium (repo hygiene) | **Fix**: Add a cleanup step that removes `.conflict-*` files older than N days, or at least log their existence in a bulletin for human review.

### F6: Ordering dependency between pull and commit
The flow is: pull → detect changes → commit → push. If pull brings in changes that create new untracked files in `agents/`, those files are included in the subsequent commit even though they were just fetched. This is mostly harmless (they'd be committed on the source instance too), but it means the commit message may attribute fetched changes to the wrong instance.

**Severity**: Low | **Fix**: Take `git status --porcelain` snapshot before pull, diff against post-pull status to isolate truly local changes.

### F7: tryPush runs only if `committed` is true
If a previous cycle committed but failed to push (network blip), the next cycle will only push if it also commits new changes. There IS a path that pushes even without `committed` (the early-return branch when `status` is empty), but this only triggers if there are zero local changes. If there are local changes that are already committed (e.g., agent self-committed), the handler stages/groups/commits them, and only then pushes. **But if the agent committed everything and there's nothing for auto-commit to do, the handler correctly falls through to the "nothing to commit → push anyway" path.** This is actually correct but non-obvious.

**Severity**: Informational | **Fix**: No fix needed, but a comment clarifying the push-on-no-changes path would help.

---

## Complexity Verdict

The handler is **moderately complex** (~488 LOC, 18 functions, 32 branches) for what is essentially a git sync job. The core complexity is in the ownership-aware conflict resolution system (functions 11–17, ~200 LOC), which implements a mini federation protocol.

**Justified complexity**: Ownership-aware resolution, per-agent commits, append-only merge. These prevent real data loss.

**Unjustifiable complexity**: Depth-50 recursion, instance detection via heuristic, orphan conflict files. These add fragility without proportional benefit.

**Recommendation**: The file is well-structured (clear function boundaries, good comments). Main improvements: (1) cap recursion at 5, (2) write explicit instance identity, (3) add conflict-file cleanup. These are surgical fixes, not a rewrite.
