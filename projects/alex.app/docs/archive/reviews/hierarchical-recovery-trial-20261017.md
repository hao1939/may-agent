# Hierarchical recovery trial — October 17

**Supports:** [Hierarchical recovery](../../proposals/unified-agent-recovery-20261017.md). Checks whether existing caller feedback, execution and retry can restore original work before adding Host machinery.

## Result

The saved caller path can recover a worker that cannot prepare its workspace.
The worker's first failure reached its caller without starting the worker's
model. A scripted supervising agent repaired the prerequisite through the real
bash tool, and ordinary automatic retry completed the original assignment.
No Host runtime change was needed for this path.

The negative cases preserved the limit: an unresolved worker exhausted its
configured two attempts, and its caller retained an operator-owned Condition.
Without a caller or declared operational route, the failed Task remained in
attention and no agent ran. Retaining failure evidence is not delivery to a
responsible agent; that case needs an App/installation route, not an inferred
Host-selected repair agent.

This is a controlled mechanical trial, not proof of autonomous diagnosis,
universal escalation, human message delivery or production cost savings.

## Revisions and reproduction

- Host source: `8646f7785c3b7d66bed2e2110c5cd43d10a38e15` (merged #380).
- Harness: local Host branch `experiment/hierarchical-recovery-20261017`,
  commit `fdabbc4af`, file `test/integration/hierarchical-recovery-trial.test.ts`.
- Run from that checkout: `bun test test/integration/hierarchical-recovery-trial.test.ts`.
- Host TypeScript check and targeted ESLint passed for the harness.
- Final trial: **3 passed, 37 assertions, 0 failures**, approximately 96 seconds.

The harness is retained on its experiment branch rather than added to #381 or
a permanent production experiment service. It uses temporary repositories and
databases, local Git remotes and scripted provider responses. It calls the real
App registry, Task controllers, inbox, managed-agent runner, bash tool and Git
workspace backend. There are no external model calls or live installation
mutations. Each case removes its fixture and closes its runtime.

## Scenario and observations

A supervising Task requests a sample from another App. Each App has its own
Git repository and normal Git Task workspace configuration. The worker's local
bare remote lacks the configured `ready` branch; real workspace preparation
fails before its agent can start. The supervisor has an independent valid
workspace and an existing request/return relationship with the worker.

| Case | Work and result | Managed invocations | Elapsed |
| --- | --- | --- | --- |
| Repair | Caller receives setup failure, uses `bash` to publish the fixture's `main` commit as remote `ready`, and waits. Automatic retry runs the worker, which reads `sample.txt`; both Tasks accept sample `42`. | Supervisor 3; worker 1; one repair command; 6 scripted provider responses | 32.2 s |
| Unresolved | Caller retains an operator ask. Worker exhausts two setup attempts, reports exhaustion to the caller and remains in attention. The original sample remains unfulfilled. | Supervisor 3; worker 0; no repair command; 3 scripted provider responses | 31.9 s |
| No route | Input goes directly to the worker without a caller or operational subscription. Two setup failures leave it in attention. No supervisor Task is created. | Supervisor 0; worker 0; no provider responses | 31.6 s |

The three supervisor invocations have distinct purposes: assignment, first
failure consideration and final result/exhaustion consideration. They do not
form a recurring checkpoint loop. The default first retry delay is 30 seconds;
the harness neither advances the clock nor manually requeues the worker.
The repair tool actually changes the remote, and readback verifies the repaired
ref. The worker's ordinary bash tool actually reads the sample after setup.

Provider usage is synthetic zero data, not a measurement of model cost. The
invocation counts and elapsed time establish mechanics for these fixtures only.

## Fixture failures and corrections

The initial fixture omitted a local branch. The Git backend legitimately fell
back to `HEAD`, so work ran without the intended setup failure. The harness also
initially watched the wrong project field on reconciliation events. Those runs
failed their final assertions and are excluded from successful-recovery evidence.
The corrected fixture uses a missing advertised remote branch and the actual
event field. The source was not changed to make the failure injection work.

## #381 cleanup review

#381 remains a separate mechanical recovery change. Its head
`a9cc67ef625bf01c530af46970cb45c87d4e3aa9` rechecks the manager after requesting
cancellation. An execution remains live until it and its joined helpers finish
cleanup, so recovery must retain the claim and active marker until then. The
same check applies with present or absent metadata and needs no extra polling
loop. Missing metadata can then be tolerated using the retained Task identity.

- Three new regressions fail with the cleanup fix removed. The already safe
  startup live-session path continues to pass.
- Focused recovery checks: **13 passed, 125 assertions**.
- Full local `bun run ci`: **3,822 passed, 3 installation-specific skips,
  0 failures, 22,029 assertions**; Host/SDK types, App boundary and lint passed,
  and browser coverage executed.
- [GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39020849750)
  passed at that head. The cleanup review thread was answered and resolved.
- [PR #381](https://github.com/hao1939/may-agent/pull/381) was marked ready for
  review; independent review and merge remain separate. No deployment occurred.

## Remaining boundaries and next change

Keep existing caller failure returns. This trial supports hierarchical recovery
without requiring every App to acquire system-repair expertise. It does not
justify a new Host recovery scheduler, universal cross-Task budget, or executor
switch.

The runner was in process and agent definitions were registered by the fixture.
The trial does not establish that a real worker subprocess can load a healthy
recipient while another App's workflow/registry bootstrap is broken. It also
does not install a fallback route for production Tasks without a caller. Those
remain explicit proposal gaps. First exercise the declared App/operational route
and the real worker startup boundary; change Host only if that exposes missing
generic execution or delivery support.

A bounded real-model trial is still needed to assess diagnosis and recovery
judgment. An operator Condition in this harness establishes a retained ask, not
that a human interface presented it or that a human acted.

## Retained evidence

Logs and checksums are kept at
`/home/hao/workspace-archive/hierarchical-recovery-20261017/`:
`trial.log`, `trial-types.log`, `trial-lint.log`, `pr381-red.log`,
`pr381-focused.log`, `pr381-ci.log`, the two fixture-failure logs and `sha256.json`.
The final trial log SHA-256 is
`da54cc4c814de919754f8c9cd7a03ae12acf354dd5c0bb89b70cc449cc0dbab9`.
