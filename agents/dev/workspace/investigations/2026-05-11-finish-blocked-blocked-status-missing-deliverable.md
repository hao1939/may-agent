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

## 2026-05-11 Follow-up: repeated P1 mismatch for `s_1778524211393_432`

Evaluator sent a newer P1 FYI for May project-review session `s_1778524211393_432` with the same status-finalization mismatch. Fresh evidence confirms this is systemic rather than a one-off artifact issue:

- The `sessions` row for `s_1778524211393_432` is `agent=may`, `source=workflow:project`, `status=interrupted`, `outcome=interrupted`, `error=NULL`.
- Targeted transcript grep shows the agent called `finish(status="blocked")`; the finish tool result returned success text beginning `🚫 **BLOCKED**: Documentation is complete...`, so the tool call completed.
- Related events then emitted `session.end` and `session.completed` with `status=interrupted`/`outcome=interrupted`, followed by `session.escalated` preserving `finishParams.status="blocked"`.
- `session_digests` for the same session recorded `trigger=end`, `outcome=failure`, and an auto-resume digest with `action=nothing` / `No recoverable work worth resuming`, even though the finish params describe a legitimate external blocker.
- DB scope check: in the last 24h, all `34` `session.end` events whose `finishParams.status='blocked'` were persisted as `sessions.status='interrupted'` / `sessions.outcome='interrupted'`. Recent examples include May project sessions `s_1778524242537_434`, `s_1778524211393_432`, `s_1778524196545_431`, evaluator metric-alert-triage escalations, and a scout arXiv rate-limit block.

This broad count changes the impact assessment: the first-class runtime/session schema appears not to represent `finish(blocked)` as a successful terminal blocked outcome anywhere in the last-day sample. Downstream aftermath and recovery logic can inspect `session.escalated.finishParams.status`, but the canonical `sessions` row and `session.completed` event currently look like an interruption/failure.

## Current Disposition

No autonomous code patch was applied because the likely implementation is outside dev's editable `agents/` lane and direct runtime `src/` edits are unavailable/forbidden here. The newer P1 FYI is **acted: investigated and documented**. Recommended runtime-owner fix: make `finish(status="blocked")` persist an explicit blocked terminal outcome (or at minimum teach `session.completed`/aftermath classifiers to prefer `finishParams.status='blocked'` over the generic `interrupted` row), then back it with a regression using `s_1778524211393_432`'s event shape.
