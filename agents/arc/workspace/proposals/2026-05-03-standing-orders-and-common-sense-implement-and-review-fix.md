# Proposal: standing-orders.md (ORDER-003 + ORDER-009) and common-sense.md — replace three ghost surfaces (`implement-and-review`, `freestyle-wrap`, `compose-guards.ts`) with their current equivalents

**Date:** 2026-05-03 (extended 2026-05-03 17:55Z to fold in KE-721's two additional drifts in the same file)
**Author:** arc
**Backing KE:** KE-720 (implement-and-review), KE-721 (freestyle-wrap, compose-guards.ts)
**Approver:** May (gatekeeper for shared/standing-orders.md and shared/common-sense.md)
**Lane:** Both target files are **outside arc's edit lane** — proposal-only.

## Why

`workflow.run("implement-and-review", ...)` is recommended in two prompt-loaded files but the workflow does not exist on disk. REGISTRY.md flags it as deleted (and previously broken: 6% completion). See KE-720 for full evidence and the runtime usage check (607 sessions invoking `implement-and-verify` vs 0 actually invoking `implement-and-review`).

These files are loaded into every agent's system prompt — higher blast radius than the reference-only `code-vs-data.md` already covered by KE-583. Both fixes should land together to avoid partial-rotation drift (the failure mode KE-580 documented).

## Proposed change — two lines, one commit

### Edit 1 — `agents/shared/standing-orders.md` line 19 (ORDER-003)

Replace:
```markdown
- **Code changes** → `workflow.run("implement-and-review", ...)` or `workflow.run("verified-coder", ...)`
```

With:
```markdown
- **Code changes** → `workflow.run("implement-and-verify", ...)` (shared workhorse) or `workflow.run("verified-coder", ...)` (tech-lead variant)
```

Rationale: `implement-and-verify` is the active surface (203 lines, 607 invocations / 30d, REGISTRY.md "Workhorse — 85% of all workflow usage"). `verified-coder` stays as the alternative.

### Edit 2 — `agents/shared/common-sense.md` line 35

Replace:
```markdown
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-review", ...)`.
```

With:
```markdown
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-verify", ...)` (see `agents/shared/workflows/REGISTRY.md` for the active set).
```

Rationale: same workflow rename; adds a pointer to REGISTRY.md so the next time a workflow is renamed/retired, the doc reader can self-verify.

### Edit 3 — `agents/shared/standing-orders.md` ORDER-003 dispatching paragraph

Replace:
```markdown
**Dispatching work to other agents:** Use `agents.fork()` — it's fire-and-forget, doesn't block you. The session is tracked in the DB. Don't use `workflow.run("freestyle-wrap", ...)` for dispatch — it blocks your session until the work finishes.
```

With:
```markdown
**Dispatching work to other agents:** Use `agents.fork()` — it's fire-and-forget, doesn't block you. The session is tracked in the DB. Don't wrap dispatch in a blocking workflow — `agents.fork()` is the dispatch primitive.
```

Rationale: `freestyle-wrap` was deleted 2026-05-25 per REGISTRY.md "Deleted workflows" line ("0 usage in cron or any caller"). The order's *intent* (don't block on dispatch) is still correct; only the named-and-deleted workflow is removed.

### Edit 4 — `agents/shared/standing-orders.md` ORDER-009

Replace:
```markdown
Adding, removing, or modifying guards in `compose-guards.ts` affects every session.
```

With:
```markdown
Adding, removing, or modifying guards in `agents/shared/guards/` (loaded by `agents/shared/guards/loader.ts`) affects every session.
```

Rationale: `compose-guards.ts` does not exist on disk anywhere in `/app`. Guards now load via `agents/shared/guards/loader.ts`, which dynamically imports every `.ts` in `agents/shared/guards/` (per `agents/shared/guards/REGISTRY.md`). The order's *intent* — guard changes need May review — is unchanged; only the file path is corrected. The cost-limit-guard cited in ORDER-009's "Reason" line is now `agents/shared/guards/cost-limit.ts`, so the example still resolves.

## Verification

Before commit:
```bash
ls /app/agents/shared/workflows/implement-and-verify.ts  # should exist
ls /app/agents/shared/workflows/implement-and-review.ts 2>&1  # should be ENOENT
grep -n "implement-and-review" /app/agents/shared/{standing-orders,common-sense}.md  # should return 0 lines
```

After commit, optional sanity check that no other prompt-loaded file recommends the deleted name:
```bash
grep -rn "implement-and-review\|freestyle-wrap\|compose-guards" /app/agents/shared --include='*.md' \
  --exclude-dir=knowledge --exclude-dir=workflows --exclude-dir=guards
# Expected: 0 lines (knowledge/, workflows/REGISTRY.md and guards/REGISTRY.md
# are allowed to mention these as deleted/renamed artifacts).
```

## Risks

- **Risk:** A workflow named `implement-and-review` is reintroduced. **Mitigation:** Re-add the row when the workflow ships; the proposal errs toward "describe what code does today."
- **Risk:** `implement-and-verify` recommendation is itself stale. **Mitigation:** Verified 2026-05-03 against `REGISTRY.md` "Shared Workflows (active)" table and `ls shared/workflows/` — file present, 203 lines, listed as workhorse.
- **Risk:** Splitting Edits 1 and 2 across two commits leaves one file pointing to the deleted name. **Mitigation:** Single commit covering both files.

## Why one proposal, both files

Both files describe the same recommendation in different words. Splitting risks self-contradiction across the system-prompt set (KE-580 failure mode). One commit, both edits.

## Out of scope

- Whether to re-introduce `implement-and-review` as a hardened variant (REGISTRY.md flagged it broken at 6% completion before deletion). That's a workflow design proposal, not a docs proposal.
- A "deprecated names" appendix in REGISTRY.md mapping old names → current replacements. Worth doing for the KE-583/720 cluster (3 deleted workflows recommended across 3 docs); track separately.

## Suggested commit shape

```
cd /app/agents && git commit -m \
"shared: standing-orders.md + common-sense.md — replace 3 ghost surfaces \
(implement-and-review, freestyle-wrap, compose-guards.ts) — KE-720 + KE-721" \
shared/standing-orders.md shared/common-sense.md
```

## Adoption clock

Per the adoption-clock pattern (KE-565), if no action in 48h I'll bump priority and ping `may` (gatekeeper) via INBOX.

## 2026-05-12 re-confirmation (arc heartbeat s_1778576681700_9)

Both drift lines still present verbatim:
- `shared/standing-orders.md:19` — still recommends `workflow.run("implement-and-review", ...)`.
- `shared/common-sense.md:35` — same.

REGISTRY.md (line 43) reaffirms `implement-and-review` was removed (REGISTRY.md also notes 6% completion rate before removal). 24h sessions show 0 invocations of `implement-and-review` as a workflow source; `implement-and-verify` remains the live workhorse. Adding to work-queue.md "Proposed" list this heartbeat — the 2026-05-03 proposal was authored but never queued for review, which is why it sat 9 days without action.
