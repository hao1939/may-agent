# Proposal: Fix two residual stale references in standing-orders.md and common-sense.md

**Date:** 2026-06-06
**Author:** arc
**Backing KE:** KE-1549
**Approver:** May (gatekeeper for both files)
**Lane:** Both target files are outside arc's edit lane — proposal-only.

## Why

Both files are loaded into every agent's system prompt. They carry two stale
references from prior fix rounds that either didn't land or used a
pre-refactor path.

## Proposed changes — two files, two edits each

### Edit 1 — `shared/standing-orders.md` line 37 (ORDER-009)

Replace:
```
Adding, removing, or modifying guards in `agents/shared/guards/` (loaded by `agents/shared/guards/loader.ts`) affects every session.
```

With:
```
Adding, removing, or modifying guards in `shared/guards/` (loaded by `shared/guards/loader.ts`) affects every session.
```

**Rationale:** Guards were moved from `agents/shared/guards/` to `shared/guards/` by commit `b3d27d840` on 2026-05-15 ("refactor: align app root layout"). The prior fix (commit `00fe28286`, 2026-06-04) wrote the pre-refactor path because the proposal was drafted before the move.

### Edit 2 — `shared/common-sense.md` line 38

Replace:
```
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-review", ...)`.
```

With:
```
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-verify", ...)`.
```

**Rationale:** This is the original Edit 2 from the 2026-05-03 proposal (KE-720/KE-721) that was approved but never applied. The work-queue item was closed with a note saying "blocked by May-only guard" — but the edit was never executed. `implement-and-review` was deleted; `implement-and-verify` is the active workhorse.

## Verification

After applying both edits:
```bash
# ORDER-009 should reference shared/guards/
grep "shared/guards/" shared/standing-orders.md
# Expected: "shared/guards/" (NOT "agents/shared/guards/")

# common-sense.md should reference implement-and-verify
grep "implement-and" shared/common-sense.md
# Expected: "implement-and-verify" (NOT "implement-and-review")

# No remaining ghost references
grep -n "agents/shared/guards\|implement-and-review" shared/standing-orders.md shared/common-sense.md
# Expected: 0 lines
```

## Risks

- **Risk:** Another refactor moves guards again. **Mitigation:** Path is verified against disk now; if it moves, the same audit pattern catches it.
- **Risk:** `implement-and-verify` is also renamed. **Mitigation:** Verified against REGISTRY.md and standing-orders ORDER-003 (already uses the correct name).

## Suggested commit

```bash
cd /app && git commit -m "fix: standing-orders ORDER-009 guards path + common-sense implement-and-verify — KE-1549" -- \
  shared/standing-orders.md shared/common-sense.md
```
