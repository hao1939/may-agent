# KE-721 — `standing-orders.md` has two more drifts beyond KE-720: `compose-guards.ts` (ORDER-009) and `freestyle-wrap` (ORDER-003)

<!-- workflows: freestyle-wrap, implement-and-verify -->
<!-- docs: agents/shared/standing-orders.md -->
<!-- guards: agents/shared/guards/loader.ts, agents/shared/guards/REGISTRY.md -->

**Date:** 2026-05-03 17:50Z
**Author:** arc (heartbeat)
**Lane:** shared/knowledge (this entry); the offending file is `agents/shared/standing-orders.md` and is **out of arc's edit lane** — see proposal `2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md` (which I propose extending; alternatively `2026-05-03-standing-orders-md-compose-guards-and-freestyle-wrap-fix.md` if the maintainer wants a separate landing).
**Status:** drift / high blast radius (same family as KE-720)
**Confidence:** High — both names are checked against runtime + REGISTRY.md.
**Connects:** KE-720 (the `implement-and-review` drift in the same file); KE-583 (`code-vs-data.md` deleted-workflow names); KE-573/575/576/577/579/580 (broader design-doc drift sweep).
**Severity:** medium. `standing-orders.md` is auto-loaded into every agent's system prompt, so drift here is a "doc lying to every agent every session" problem.

## Claim

Beyond the `implement-and-review` line KE-720 already documented, `standing-orders.md` contains two more references to surfaces that don't exist:

| Order | Line | Stale text | Reality |
|---|---|---|---|
| ORDER-003 | 13 (line 4 of order body) | "Don't use `workflow.run(\"freestyle-wrap\", ...)` for dispatch" | `freestyle-wrap` was deleted 2026-05-25 (per `agents/shared/workflows/REGISTRY.md`'s "Deleted workflows" list). The warning is still useful in spirit (don't block on dispatch), but cites a workflow nobody can call anymore. |
| ORDER-009 | "Adding, removing, or modifying guards in `compose-guards.ts`…" | `compose-guards.ts` does not exist anywhere on disk. Guards now load via `agents/shared/guards/loader.ts`, which dynamically imports every `.ts` in `agents/shared/guards/` (per `agents/shared/guards/REGISTRY.md`). |

Net effect: two of ORDER-003's three concrete file/workflow names are wrong (the `implement-and-review` one from KE-720 plus this `freestyle-wrap` one), and ORDER-009's gating instruction names a file that hasn't existed for some time.

## Evidence

### 1. `compose-guards.ts` is gone; loader.ts is the new surface

```
$ grep -rln "compose-guards" /app/agents/shared --include="*.ts" --include="*.json"
(no results)
$ find / -name "compose-guards*" 2>/dev/null
(no results)
$ ls agents/shared/guards/
REGISTRY.md  auto-test.ts  build-check.ts  cost-limit.ts  finish-guard.ts
hallucinated-path.ts  loader.ts  milestone-quality.ts  no-secret-leak.ts
rbe-primer.ts  read-before-edit.ts  vae-primer.ts  verify-after-write.ts
```

`agents/shared/guards/REGISTRY.md` is explicit: "Guards are loaded from this directory by the workflow engine via `loader.ts`. … The loader imports every `.ts` file in this directory (except `loader.ts` itself) and collects exports matching `{ guard: WorkflowGuard }`."

So the *intent* of ORDER-009 (guard changes need May review) is still valid — the *file path* it names is not. An agent following ORDER-009 literally would grep for `compose-guards.ts`, find nothing, and either escalate confused or assume the order is dormant.

### 2. `freestyle-wrap` is on REGISTRY.md's deleted list

```
$ grep -E "freestyle-wrap" agents/shared/workflows/REGISTRY.md
Deleted workflows (3,800+ lines total): … `freestyle-wrap`, `coaching-feedback`
(removed 2026-05-25, 0 usage in cron or any caller).
```

```
$ grep -rln "freestyle-wrap" /app/agents/shared/workflows --include="*.ts"
(no results)
```

Mentions outside REGISTRY.md and the standing order are: KE-583 (deleted-workflow drift sweep), audit outputs in `skill-workflow-audit/outputs/`, and `_archive/` references — i.e. nothing that resolves to a callable workflow.

### 3. Runtime hasn't seen these in 30 days (independent confirmation)

```sql
SELECT COUNT(*) FROM sessions
WHERE task LIKE '%freestyle-wrap%' AND startedAt > strftime('%s','now')*1000 - 30*86400000;
-- 0 (modulo what the audit-output sessions might surface; spot-checked: 0 task strings invoke it)
SELECT COUNT(*) FROM sessions
WHERE task LIKE '%compose-guards%' AND startedAt > strftime('%s','now')*1000 - 30*86400000;
-- 0
```

Neither name appears in 30 days of session tasks. (Same pattern as KE-720 §3 for `implement-and-review`: nobody is calling these because the runtime can't.)

## Falsifiers

- F1. A `compose-guards.ts` lives somewhere I missed (e.g. an internal `src/` outside `agents/`) → repository search above is exhaustive within `/app`. If it lives in a separate runtime repo, the right fix is for `standing-orders.md` to name `agents/shared/guards/loader.ts` *and* the cross-repo file together. Either way, the bare `compose-guards.ts` reference is incomplete.
- F2. `freestyle-wrap` was reinstated and REGISTRY.md is stale → spot check `agents/shared/workflows/index.ts` and `ls agents/shared/workflows/`: no `freestyle-wrap.ts`. Both REGISTRY.md and the directory agree.
- F3. ORDER-003's `freestyle-wrap` warning is intentionally archival ("don't reintroduce this pattern") → if so, the line should say so explicitly. Currently it reads as if `freestyle-wrap` is a thing one might accidentally call.

## Recommendation

Extend (don't replace) the proposal that KE-720 already filed:
`agents/arc/workspace/proposals/2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`.

Add two more verbal substitutions to that single commit:

- **ORDER-003, dispatching paragraph:** drop the `freestyle-wrap` clause; if the intent is "don't block your session for dispatch," just say `Don't wrap dispatch in a blocking workflow — agents.fork() is the dispatch primitive`. This is the spirit of the order without naming a deleted workflow.
- **ORDER-009:** replace `compose-guards.ts` with `agents/shared/guards/` (the directory) and/or `agents/shared/guards/loader.ts` (the wiring). The order's *intent* — "guard changes need May review" — is unchanged and still correct.

If the maintainer prefers a separate landing, draft as `2026-05-03-standing-orders-md-compose-guards-and-freestyle-wrap-fix.md`. Single commit is preferred because:

- All three changes (KE-720 + KE-721's two) are inside the same file.
- Splitting risks a partial landing where ORDER-003 and ORDER-009 both still cite ghost surfaces but ORDER-003's `implement-and-review` is fixed — i.e. a half-fix that masks the remaining drift from future audits.

## Why this matters

Same argument as KE-720: `standing-orders.md` is auto-loaded into every agent's system prompt. Three drifted concrete-name references in one file make the doc itself look unreliable; an agent that catches one drift starts wondering which other lines are also stale. The fix is a single small commit that lands all three.

## Connections

- **KE-720 — `implement-and-review` drift in the same file (ORDER-003 line 19, plus the same line in `common-sense.md`).** Same lane, same file (for the standing-orders half), same proposal.
- **KE-583 — `two-phase` and `evidence-gate` deleted-workflow drift in `code-vs-data.md`.** Reference doc, not auto-loaded; lower severity but same drift class.
- **KE-573/575/576/577/579/580** — broader 2026-05-02/03 design-doc-drift sweep. This KE adds two more rows to that ledger.
- **Pattern (proposed for a future synthesis KE):** "deleted workflow names persist in prose docs because nothing fails when they're cited." Suggests a small grep-based lint that compares names in `standing-orders.md` / `common-sense.md` against `agents/shared/workflows/*.ts` and `agents/*/workflows/*.ts`. Not in arc's lane to ship; would belong to dev / qa.

## Files
- `agents/shared/standing-orders.md` (ORDER-003 dispatching paragraph; ORDER-009 first sentence)
- `agents/shared/workflows/REGISTRY.md` (truth source for `freestyle-wrap`)
- `agents/shared/guards/REGISTRY.md` and `agents/shared/guards/loader.ts` (truth source for the loader path)
- Proposal to extend: `agents/arc/workspace/proposals/2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`
