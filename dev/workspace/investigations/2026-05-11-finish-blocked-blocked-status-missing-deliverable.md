# Finish Blocked: blocked finish misclassified as interrupted + missing deliverable display

## Trigger

Evaluator sent a P1 FYI for May project-worker session `s_1778515193714_311`: the transcript showed a real write/read/commit of `shared/projects/aks-rp-e2e/outputs/project-status.md` followed by `finish(status="blocked")`, but the persisted session row recorded `status=interrupted`/`outcome=interrupted`, and the finish tool result displayed the deliverable as `MISSING` even though commit `e69421994` contains it.

## Evidence Checked

- `sessions` row for `s_1778515193714_311` is `agent=may`, `source=workflow:project`, `status=interrupted`, `outcome=interrupted`, `error=NULL`.
- Related events show evaluator reviewed the session as `reviewedVerdict=acceptable` and escalated the issue to dev after verifying the artifact and commit existed.
- Targeted transcript extraction from `/app/.state/sessions/history/s_1778515193714_311/session.jsonl` showed:
  - write to `/app/agents/shared/projects/aks-rp-e2e/outputs/project-status.md`
  - read-back of that file
  - `git commit e69421994` adding `shared/projects/aks-rp-e2e/outputs/project-status.md`
  - `finish(status="blocked")`
  - finish tool output listing `shared/projects/aks-rp-e2e/outputs/project-status.md ⚠ MISSING`
- Existing guard code in `agents/shared/guards/finish-guard.ts` already has `deliverablePathCandidates()` that accepts agents-repo-relative aliases such as `shared/projects/...` by checking `/app/agents/shared/...` when root is `/app`.
- Repo search found no editable `agents/` implementation for the finish tool's human-readable `⚠ MISSING` deliverable display. The available guard only throws ghost-deliverable errors for `status="success"`, so a blocked finish can still print a misleading missing marker without being rejected.
- Attempted targeted test command `cd /app/agents && bun test shared/tests/finish-guard-import.test.ts`; it failed before running assertions because the current Bun/Vitest shim lacks `vi.importActual`, not because of the path-alias logic.

## Root Cause Assessment

This is not a lost artifact. It is a bookkeeping/display mismatch across two layers:

1. **Terminal status mapping:** `finish(status="blocked")` from a worker session is persisted/routed as `interrupted`, consistent with the older documented runtime limitation that `blocked` is not a first-class session-table terminal status.
2. **Deliverable display path resolution:** the finish tool's blocked-output display likely uses a separate existence check from `validateFinishDeliverables()` or runs with a different root/path normalization. It marks `shared/projects/...` as missing even though the repo-relative file exists and is committed.

## Impact

- Aftermath routing sees `terminal status: interrupted` and sends otherwise useful blocked project iterations into `needs_triage`.
- The misleading `MISSING` marker can cause reviewers to suspect artifact loss even when `git show <commit>:shared/projects/...` succeeds.
- This contributes to finish-blocked friction and evaluator noise, but it is not currently an unresolved dirty-exit source: the session committed its artifact and the paired strict finish-block metric remains zero.

## Next Safe Fix Path

The durable fix is in runtime finish/session bookkeeping, not in the already-patched shared guard file:

1. Find the finish tool result formatter / `finish()` implementation outside `agents/` (likely runtime `src/`, not mounted/editable in this container).
2. Reuse the same agents-repo-relative candidate logic as `deliverablePathCandidates()` for all deliverable display/status output, including non-success statuses.
3. Decide how `finish(status="blocked")` should persist: either map to a first-class done/blocked outcome or explicitly teach aftermath routing that blocked finishes with committed deliverables are not interrupted failures.
4. Add a regression covering a blocked finish with deliverable path `shared/projects/<id>/outputs/file.md` under root `/app` where the real file is at `/app/agents/shared/projects/...`.

## Current Disposition

No autonomous code patch was applied because the likely implementation is outside dev's editable `agents/` lane and direct runtime `src/` edits are unavailable/forbidden here. This heartbeat treats the P1 FYI as **acted: investigated and documented**, with follow-up needed from the runtime owner when `src` is available.
