# Audit disposition: evaluator-aftermath ENOSPC for `s_1787328194849_524`

**Audit task:** `audit-aftermath-enospc-s_1787328194849_524`  
**Incident workflow run:** `wr_1787328284945_v7ir`  
**Evaluator execution:** `s_1787328291773_531`  
**Disposition:** Recovery required; the source session is durable, but its evaluation is not.

## Executive disposition

The source Gym session completed successfully and has a durable, hash-addressed result. The evaluator-aftermath attempt did not publish an evaluation or structured skip. It failed while writing the evaluator execution's session storage on the shared `/app` ext4 filesystem, before a complete assistant record or result could be persisted.

This is not evidence of a scoring, criteria, or evaluation.app business-logic defect. The immediate failure boundary is platform session persistence under `/app/.state/sessions`; capacity management and recovery of the stranded workflow/session rows belong to the May-agent runtime/platform owner. A separate runtime bookkeeping weakness is visible because both the evaluator session and workflow run remain recorded as `running` after the reconciler already recorded the ENOSPC failure.

The reconciler-compatible recovery is: restore and verify safe storage headroom, then use the supported task-reconciler/evaluator-aftermath retry path for the exact source session. The replay must first query `evaluations` for idempotency, then publish exactly one evaluation or structured skip for `s_1787328194849_524`. Do not directly mutate or recreate `runtime/session-aftermath/s_1787328194849_524`.

## Primary evidence

1. `sessions.sessionId=s_1787328194849_524` is `done`, with `endedAt=1787328247757`, `outcome=done`, and `result_ref=sessions/s_1787328194849_524/result.json` (`result_bytes=6511`, recorded SHA-256 `ed4c70680ecc2fecdfea1fd9bdde6d044ce7ab71a8f263f24967c493a8abb9c6`). A direct `sha256sum` of the current result file matched that recorded digest.
2. `/app/.state/sessions/s_1787328194849_524/result.json` contains the completed Gym result and a structured `state=waiting` dependency disposition. The source result therefore survived independently of the failed aftermath attempt.
3. The `evaluations` query for `sessionId=s_1787328194849_524` returned zero rows. There is no durable evaluation record to preserve or treat as adequate.
4. Event `5913712` records handler `workflow:evaluator-aftermath` as blocked for `runtime/session-aftermath/s_1787328194849_524` with `Workflow "evaluator-aftermath" error: ENOSPC: no space left on device, write`; event `5913714` records the reconciler's attention disposition for the same task and exact error.
5. The failed evaluator execution directory is `/app/.state/sessions/s_1787328291773_531`. Its `session.jsonl` is exactly 4096 bytes and ends in the middle of the first assistant JSON record; `meta.json.tmp` is zero bytes; no `result.json` exists. This is direct evidence of an interrupted session-storage write, not a completed evaluation whose database insert alone went missing.
6. `findmnt -T /app/.state/sessions/s_1787328291773_531/session.jsonl` maps that storage to `/app` on `/dev/sdd[/app]`, ext4. Current `df -h /app` reports a 251 GiB filesystem with 237 GiB used, 2.2 GiB available, rounded to 100% utilization; inode use is only 44%. Current free space does not reconstruct the exact historical free-byte count, but it corroborates a byte-capacity boundary rather than inode exhaustion.
7. `workflow_runs.runId=wr_1787328284945_v7ir` and `sessions.sessionId=s_1787328291773_531` both still report `running`, while the task reconciler already persisted the ENOSPC attention outcome. The run artifact `/app/.state/workflow-runs/wr_1787328284945_v7ir/run.json` also remains `running` and has no result summary/reason.

## Impact

- **Preserved:** the exact source session transcript, metadata, checkpoint, result, and source result digest.
- **Missing:** a durable row in `evaluations` (or structured skip) for the source session.
- **Corrupted/incomplete aftermath artifacts:** the evaluator transcript is truncated; its result artifact is absent; its temporary metadata write is empty.
- **Operational residue:** stale `running` records remain for the evaluator execution and workflow run despite the durable reconciler attention event.
- **Scope:** this audit proves the failure for this attempt. It does not establish which directory or process consumed the host's capacity, and it does not justify deleting data or changing evaluation criteria.

## Ownership and defect boundary

### evaluation.app responsibility

- Detect the missing evaluation and preserve exact-session/idempotency requirements on replay.
- Keep the incident auditable and avoid treating the partial evaluator transcript as a valid evaluation.
- No evaluation scoring or criteria defect is demonstrated by the available evidence: execution failed before evaluation evidence gathering or `finish().result` could be durably recorded.

### May-agent runtime/platform responsibility

- Own byte-capacity monitoring/headroom for the shared `/app` filesystem and the session/workflow persistence implementation under `/app/.state`.
- Determine the actual capacity consumer using platform telemetry or host-level storage accounting; this audit's bounded `du` view does not explain the full filesystem usage.
- Reconcile stale `running` session/workflow records after a workflow-level persistence error, without hand-editing Host task storage.
- Once headroom is verified, drive the supported reconciler retry/replay for the exact aftermath task.

## Recovery recommendation

1. Platform owner verifies sustained writable headroom on `/app` (bytes, not only inodes) and identifies/contains the capacity source without deleting source-session evidence.
2. Platform owner verifies that session and workflow result persistence can complete and that ENOSPC leaves terminal/error bookkeeping rather than stale `running` rows.
3. Through the supported task-reconciler/evaluator-aftermath recovery path, retry the exact evaluation target `s_1787328194849_524`; do not create a substitute source session and do not directly edit the `runtime/*` task.
4. Replay must query `evaluations` first. Because the current count is zero, it should publish exactly one canonical evaluation or structured skip tied to `s_1787328194849_524`.
5. Closure evidence should include: a non-running terminal workflow run, a durable `evaluations` row (or canonical structured skip receipt), exact source-session identity, and reconciler completion evidence for the existing runtime aftermath task.

## Audit conclusion

The durable evaluation-delivery acceptance is not currently met for `s_1787328194849_524`; recovery is required. The audit-system diagnosis and routing are complete: source evidence is intact, evaluation output is absent, the write failed at shared runtime session persistence on `/app`, and capacity/replay/bookkeeping recovery belongs to the May-agent platform plus the supported reconciler path—not to a direct evaluation.app mutation of `runtime/session-aftermath/s_1787328194849_524`.
