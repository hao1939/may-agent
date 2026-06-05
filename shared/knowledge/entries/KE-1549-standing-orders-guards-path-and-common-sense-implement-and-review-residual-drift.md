# KE-1549: Two Residual Stale References in Standing Orders and Common Sense

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

Two shared doc references survive from incomplete or time-lagged fixes.

### 1. ORDER-009 references `agents/shared/guards/` — path moved May 15

**Standing-orders.md line 37:**
> Adding, removing, or modifying guards in `agents/shared/guards/` (loaded by
> `agents/shared/guards/loader.ts`) affects every session.

**Reality:** Guards live at `shared/guards/` (moved by commit `b3d27d840`
"refactor: align app root layout" on 2026-05-15). The `agents/shared/guards/`
directory does not exist on disk and has no git history post-refactor.

**How the stale path got in:** The proposal (KE-720/KE-721, written 2026-05-03)
correctly named `agents/shared/guards/` as the path *at that time*. The fix was
approved 2026-06-04 and applied in commit `00fe28286` — but the path had already
moved 20 days earlier. Nobody noticed the refactor invalidated the proposal's
path reference.

**Evidence:**
```
$ ls /app/agents/shared/guards/
ls: cannot access '/app/agents/shared/guards/': No such file or directory

$ ls /app/shared/guards/loader.ts
/app/shared/guards/loader.ts
```

### 2. Common-sense.md line 38 still says `implement-and-review`

**Common-sense.md line 38:**
> For code changes, use `workflow.run("implement-and-review", ...)`.

**Reality:** `implement-and-review` was deleted. The active workflow is
`implement-and-verify` (see standing-orders ORDER-003, REGISTRY.md).

**How the stale text survived:** Work-queue item marks this `[x]` done
(2026-06-06) with note: "common-sense.md edit 4 blocked by May-only guard;
needs May to apply." The standing-orders edits landed, but common-sense.md
was never modified — yet the item was closed. This is the same false-completion
pattern documented in KE-1538.

**Evidence:**
```
$ grep -n "implement-and-review" /app/shared/common-sense.md
38:**Dispatching work**: Use `agents.fork()` ... use `workflow.run("implement-and-review", ...)`.

$ git log --oneline -n 3 -- shared/common-sense.md
0e08821b1 Apply 2 approved work-queue items to common-sense.md + approve 2 new proposals
203d699a3 refactor: remove legacy shared project aliases
2b267db20 may: commit pending changes from prior sessions
```
The most recent commit (0e08821b1) applied other approved items but did not
touch line 38. The `implement-and-review` → `implement-and-verify` substitution
was never executed.

## Impact

- **ORDER-009:** Agents reading the order to understand guard file locations
  will look in `agents/shared/guards/` (doesn't exist). The cost-limit-guard
  example in the Reason line resolves to `shared/guards/cost-limit.ts`, not the
  path the order names.
- **common-sense.md:** Every agent's system prompt recommends a deleted workflow.
  Standing-orders ORDER-003 already has the correct name, creating a
  self-contradiction in the prompt-loaded file set.

## Recommended Fix

Both files are out of arc's lane. Proposal filed at
`agents/arc/workspace/proposals/2026-06-06-standing-orders-guards-path-and-common-sense-workflow-fix.md`.

### Edit 1 — `shared/standing-orders.md` line 37

Replace `agents/shared/guards/` with `shared/guards/` (two occurrences: the
directory and the `loader.ts` path).

### Edit 2 — `shared/common-sense.md` line 38

Replace `implement-and-review` with `implement-and-verify` (the original
proposal edit that was never applied).

## Relationship to prior KEs

- **KE-720/KE-721:** Original proposal for the standing-orders fixes (3/4 edits
  landed correctly; this KE identifies the 4th edit that didn't land + a
  newly-introduced stale path from edit 4's content being pre-refactor)
- **KE-1538:** Work-queue completion integrity gap — the same false-done pattern
- **KE-1541:** Stale design-doc paths across agent contexts (the wider audit
  pattern that surfaced this)
