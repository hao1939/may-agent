# Historical pilot evidence

**Historical context:** [Host And App Boundary](../../2a-design/system-boundary.md). Retained rationale and evidence; this record does not define the current contract.

> Dated September 6, 2026 verification record. Statements about running or
> stopped processes describe the observation window, not current live state.
> See the [active proposal](../../proposals/authority-boundary-simplification.md)
> for remaining work and [Task Resource Engine](../../2a-design/task-resource-engine.md)
> for the current contract.

# May authority-boundary pilot — September 6, 2026

**Status:** Initial experiment and follow-up live verification completed. The
main-based pilot remains running; not production rollout approval.

Related proposal: [One Fact, One Owner](../../proposals/authority-boundary-simplification.md).

## Outcome and limits

The candidate has run in an isolated MLVM container with host `/workspace/app`
mounted at `/app`. Existing Tasks, Conditions, workflow execution, source
releases, and recovery were sufficient. The experiment exposed remaining
lifecycle defects and justified small fixes; it did not justify a new workflow
framework or supervision layer.

The old `may-agent` container remained stopped. Its database, Apps, historical
incident, staged source, and release authority were not migrated. No Herdr
worker, PR publication, review request, validation dispatch, approval, or merge
was changed. This is a short bounded experiment, not a fleet endurance test.

After the initial experiment's final restart and readback, all three scoped pilot containers were
stopped cleanly with exit 0. Their state and artifacts were retained; nothing
was deleted. The model gateway remained running. A final PR read confirmed
#51 remained open, published, and at the same head.
The stopped database passed SQLite `quick_check`: five completion receipts,
one policy-blocked Task, and eight diagnostic sessions (seven errors, one done).

## Reproducible identities

Runtime branch: `fix/settled-task-authority-20260906`, based on
`fb9c8278e9e8459908eb1c7291304e846325f7da`, in
`/app/projects/may-agent-worktrees/settled-task-authority-20260906`.

| Candidate commit | Change | Result |
| --- | --- | --- |
| `3739c071b038831ab362f1ed1535d83338617018` | Honor explicitly closed maintain Tasks; prefer current live generations in reads and filtered lists | Focused regressions and closure checks passed; the local daemon then exposed stale receipt persistence after a revised generation completed |
| `7b3e82e44ecec2bcbd1a000c0c9f900957f50865` | Compare receipt generations, not just presence, when committing the existing mutation scope | Revision 2's completion became visible on MLVM; no extra state or storage table |
| `fb7fcb6f4b914cd07944ae7c3e7ef911b153c895` | Distinguish rejected result contracts from execution failures; use existing attention handling | Invalid output settled without automatic re-execution, including after restart; the transient process-failure retry regression still passed |

Final executable: `may-agent-v3`, reporting `may-agent v0.1.0 (fb7fcb6f)`.

```text
SHA256 executable:
07607c8e07c74dcd3c0368fc7dd5c8b35070b1a20fd315c7f1cced4e692972e8
SHA256 source-v3.tar:
a3dd0831cb49e242acfca670661bc76ff9240b8af21f32d3d32398014143902d
```

The container reused existing image layers, pinned to
`sha256:6d42cb94a309917818c80543e7ad323d791549c4e2f1395c7bdbb38e23a69b44`,
with the candidate executable as its entrypoint. The image tag alone is not
the runtime identity. Dynamic SDK source came from the candidate archive;
the reused installed TypeBox version was verified as `1.1.38`.

Final test definitions are a separate committed fixture:
`3a388304bc4c4505b3db1204dc32e89fcb2b3614`. Its App is `proposal-pilot`,
agent is `pilot-owner`, and instance is `proposal-pilot`. Its state is only
`/app/tmp/may-proposal-mlvm-20260906/pilot/.state` inside the container.
The final container is `may-proposal-pilot-v3-20260906`; prior stopped trial
containers and artifacts remain available for comparison.

All run files are retained under `/app/tmp/may-proposal-mlvm-20260906` locally
and `/workspace/app/tmp/may-proposal-mlvm-20260906` on MLVM. They include source
archives, committed fixture bundles, the runtime patch series, trial scripts,
read-only PR observation, and logs. The runtime commits are local, not pushed
or added to PR #51 by this experiment.

Primary raw logs are `mlvm-lifecycle-wait.log`,
`mlvm-wake-model-preflight.log`, `mlvm-delivery.log`,
`mlvm-v3-invalid-settles.log`, `mlvm-v3-restart-invalid.log`,
`mlvm-final-judge.log`, and `mlvm-final-restart-stop.log` in that directory.
`mlvm-before-judge-fix.db` preserves the stopped failing pilot; `mlvm-final.db`
is the final stopped-state readback. Failed setup and probe logs are retained
alongside successful runs, rather than overwritten.

## What was exercised

| Case | Observed result |
| --- | --- |
| Standing Task converges, then an App control explicitly closes it | `work/standing` retained its generation-1 receipt; three duplicate observations and subsequent restarts did not recreate it |
| Same Task receives revised desired work | `work/bounded` completed generations 1 and 2 with one attempt each; the current receipt is generation 2 |
| Capability unavailable | `work/waiting` persisted one exact Condition; three duplicate requests and an unrelated credential event caused no extra attempt |
| A fallback review becomes due | One deterministic recheck after the 60-second deadline, with no model session; this is allowed runtime activity, not agent polling |
| Matching capability restored | The matching `credential.state` event resumed and completed the same generation-1 Task; three attempts total: initial check, deadline check, restored-capability check |
| Published PR assessment | A real read-only snapshot of `hao1939/may-agent#51` parked on missing pilot policy; one attempt, zero model sessions, no provider write; repeated observations stayed quiet |
| Bad authored result under candidate 2 | Five model-route failures led to five automatic interrupted/released attempts before the pilot was stopped |
| Same bad result under candidate 3 | One further attempt failed into `attention` with `HandlerResultInvalid`; the automatic retry path and restart did not recreate work |
| Source reload | Committed definitions were activated through the existing runtime reload event; a failed reload retained the previous source rather than silently loading dirty definitions |
| Bounded agent job | The verified `gpt-5.6-sol` route returned a schema-backed assessment; App workflow acceptance produced the generation-3 `work/judge` receipt at `2026-09-06T14:16:09.956Z` |

The accepted diagnostic output was:

```json
{
  "classification": "unknown",
  "reasoning": "Review readiness is unknown because the HTTP 503 prevented obtaining any review list."
}
```

That question deliberately tested the code → agent → structured result → App
acceptance path. The HTTP 503 was a supplied diagnostic scenario, not a claim
that GitHub returned 503 during the PR read. A real implementation or review
job would require its own evidence; this small probe does not establish general
agent judgment quality.

## Failures and adjustments

1. **Admission was not execution.** Starting with `--socket` admitted a Task
   but installed no Task controller. The isolated launch now uses the existing
   `--cron --socket` invocation, with no scheduled agent jobs. No new flag or
   runtime mode was added.
2. **Testing admission alone missed completion.** The first regression covered
   the live successor but not its completed receipt. Extending the test and
   checking the daemon's database exposed an ID-only mutation filter. The fix
   compares existing receipt generations inside the same fenced transaction.
3. **A model catalog was not capability proof.** `/v1/models` advertised
   `claude-opus-4-6`; actual requests returned `model_not_supported`. An
   independent `claude-opus-5` probe also failed. A small `gpt-5.6-sol` inference
   succeeded before selecting that route. Gateway configuration was not edited.
4. **Two failure layers compounded.** The fixture returned authored
   `state: "error"`, which is not a valid Task result; Host rejection then used
   the general retry path. The fixture now returns a schema-tested explicit
   wait on failure. The runtime separately parks a rejected result using the
   existing attention state. This is not a generic classifier for all permanent
   provider failures, and it preserves actual process-failure retries.
5. **Generated views are not committed definitions.** The fixture omitted an
   ignore for the existing generated `agents/**/last-session.md`; source reload
   correctly refused it. The fixture now ignores that specific generated view.
   No source-integrity guard was disabled. The refused reload caused one more
   diagnostic attempt under the old source, which candidate 3 also parked.
6. **The test client raced startup.** A first post-restart send failed before
   the socket existed. The harness now uses the existing bounded socket retry
   helper. Acknowledgement and effective source/Task state are checked separately.

Seven diagnostic sessions failed at the unsupported model route across the
iterations; one diagnostic session succeeded on the verified route. The normal
lifecycle, credential wait, and PR-policy assessment created no model sessions.
The small standalone route probes are additional provider requests outside
May's session count; they are not hidden inside a “one call total” claim.

One optional session-digest write logged `database is locked`; Task records and
final acceptance remained readable. This warning is retained as a follow-up
observation, not represented as fixed or used to justify a storage rewrite.

## Verification and remaining gates

Final candidate verification: 230 Task/runtime tests, 31 read/cancellation/source
release tests, and TypeScript checking passed. The fixture has 16 eligibility
tests and three schema tests for successful, unavailable, and wrong-answer
agent results. No new runtime dependency, persisted state field, queue, or
workflow-status table was introduced. Most added lines are regressions.

The PR function is 34 lines and derives an eligible job from facts; it does not
persist a stage. Its branches were tested, but publish/request-review/validate
branches were not connected to live provider writes. The PR snapshot used
head `d90b45d4c671f78725cecdcb5c89fad4d21c99c6`: open, published, `CLEAN`, with
empty reviews/checks. The isolated App has no agreed repository policy. This
is a missing pilot input, not proof that GitHub has no branch protection or
that PR #51 is ready for approval.

Before production rollout:

- Establish the supported checkout, correlated Host Operations Task, and
  artifact/SDK/UI release proof. The old staged source is not a Git checkout;
  the old DB has no corresponding Host Operations authority.
- Reconcile the historical stopped-generation-3 / live-generation-4 conflict
  with exact evidence and a supported mutation. The new admission fix does not
  authorize or automatically clean up that pre-existing successor.
- Agree the repository's publication, review, live-validation, and approval
  contract. Then prove one real PR outcome using the existing owner, provider
  tools, and observer. No `event-watchd` May adapter was implemented here.
- Test uncertain external writes and provider readback with the actual adapter.
  Pure eligibility tests do not establish crash-safe publication or dispatch.

These are rollout gates, not reasons to add a new framework before review.

## Follow-up: live watch and focused PR on current main

The human subsequently requested a PR and continued live observation before
updating it. The initial candidate descended from 119 unpublished local
commits. It must not be published as a small fix against remote `main`.
The fixes were ported onto `b4ea4071` in branch
`fix/task-settlement-main-20260906`, independently of the broader PR #51.
The focused runtime PR is [may-agent#54](https://github.com/hao1939/may-agent/pull/54).
Current main already writes newer completion receipts correctly, so that
part of the port adds regression coverage rather than a redundant writer.

The original `fb7fcb6f` container was restarted and exercised with new Task
identities. Two generations completed, twelve duplicate requests and an
unrelated fact stayed quiet, one 60-second fallback rechecked deterministically,
the matching event completed the original waiting generation, and one bounded
agent job completed once. It was then stopped after a 40-second quiet watch.

The main-based candidate uses container `may-proposal-pilot-main-20260906`,
the same required `/workspace/app:/app` mount, and a separate
`pilot-main/.state` database. The old production container remains untouched.
Its committed fixture started at `3a388304` and was explicitly reloaded to
`eed21dfba17db574d759a4f0cb83ef9dd64ed36f` to add a deliberately rejected
result without making a model call.

### Failures found during the main-based live watch

1. Candidate `56b0e256` lost the exact Condition deadline after duplicate
   waiting claims: the Condition still had `reviewAfterMs: 60000`, while the
   Task index had `next_check_at: null`. A new resource-backed regression
   reproduced this. Commit `0877ed63` reuses the existing deadline calculation
   when acknowledging a still-waiting Condition or child wait. Dependency-only
   blocked work keeps its existing event-driven behavior.
2. Main also contained an older rule that removed an App-authored deadline
   after three unchanged reviews. The contract regression reproduced that
   removal. Commit `748f8d1d` deletes that overriding helper: the App, not the
   Host's review counter, decides whether to keep or retire its Condition.
   Live verification across that threshold is recorded in the follow-up logs.
3. Two harness failures are not runtime defects: restarting retained the
   previous active App source until an explicit reload; a concurrent judgment
   job changed a global session-count assertion in the timer watcher. The
   remaining timer checks are run without concurrent model jobs, and the
   rejected-result probe was retried only after activating the committed fixture.

Final candidate verified in the repeated live run:
`748f8d1d5dee6c940f6935be121488e61fb124ca`.
Executable `may-agent-main-v3` SHA256:
`614b12d310a6847a81f2cf6ee3cfe09a5d21202aec9a9ded55a415d2bd2f35c6`.
Source archive SHA256:
`97a682568e20843e7df8e44590f938642c507846d41df66687341dd68d66f5bc`.
The container entrypoint path remains `may-agent-main`; stopped-container
replacement retains the earlier binaries. SDK/control sources are unchanged
between the main-based candidates and remain from their `56b0e256` archive.

Local `bun run ci` on `748f8d1d`: 2,546 passed, three deployment-catalog
checks intentionally skipped, zero failed; Host/SDK type checks, canonical
boundary, and lint-error checks passed. This used Bun 1.3.14 and Node 22.19.0;
hosted CI is responsible for the documented Node 24 and container checks.
Twenty separate pilot-fixture tests passed; these are not committed Host tests.
Hosted [CI run 34040571358](https://github.com/hao1939/may-agent/actions/runs/34040571358)
subsequently passed both Quality and Container on the same `748f8d1d` PR head.

Follow-up raw evidence is retained in `mlvm-watch-cycle-v3.log`,
`mlvm-watch-wake-v3.log`, `mlvm-watch-v3-quiet-stop.log`,
`mlvm-watch-main-start.log`, `mlvm-main-v2-repeated-deadlines.log`,
`mlvm-main-v2-invalid-judge.log`, and `mlvm-main-v2-source-reload-watch.log`.
The failed main-based database is retained as
`mlvm-main-before-deadline-fix.db` on MLVM. The harness and upgrade scripts are
retained beside it. None of these checks establish PR publication/review/
validation/approval automation or production migration.

### Final live result

Candidate `748f8d1d` passed four consecutive real-time 60-second reviews at
14:48:18, 14:49:18, 14:50:18, and 14:51:18 UTC. The next deadline survived
every review, including the previously failing third-review threshold.
The matching credential fact then completed `work/final-waiting` generation 1:
six deterministic attempts (initial, four reviews, restored capability), no
model sessions. Twelve duplicates and an unrelated credential fact had caused
no extra waiting attempt before the deadline.

`work/final-invalid` failed into attention after one deliberately invalid
result at 14:48:00. It remained at one attempt through several minutes and
restart. An explicit corrected intent completed generation 2 at 14:51:58.
The final candidate's one fresh bounded agent call completed
`work/final-judge` generation 1 at 14:52:01. As in the first experiment, its
question was a supplied failed-observation diagnostic, not a real PR review.

A second clean restart and 40-second quiet watch preserved all 13 receipts,
29 attempt records, and two diagnostic sessions. There were no remaining
live Tasks or extra attempts/sessions. The final stopped snapshot's SQLite
`quick_check` returned `ok`. The container was left running as
requested, with the expected executable hash and bind mount. Its final sampled
usage was 0.14% CPU and 47.62 MiB memory. Production May remained exited with
its original August 28 stop timestamp; previous pilot containers stayed stopped.

The final logs are `mlvm-main-v3-four-reviews.log`,
`mlvm-main-v3-invalid.log`, `mlvm-main-v3-health-watch.log`,
`mlvm-main-v3-final-restart.log`, and `mlvm-main-v3-final-daemon.log`.
Stopped-state snapshots before the restart and after the completed work were
retained as `mlvm-main-v3-before-restart.db` and `mlvm-main-v3-final.db`.
Slow event-subscriber warnings, up to roughly 300 ms in this small run,
remain a performance limitation; they were not treated as fixed or as task loss.
Another 40-second post-PR watch at 14:55:03 UTC found the same 29 attempts
and two sessions, with the pilot still running quietly.

The follow-up supports these specific lifecycle/wait invariants. It does not
certify long-run production reliability, historical-state migration, or the
unimplemented end-to-end PR delivery adapter. No autonomous monitoring continues
after this interactive watch unless separately requested.
