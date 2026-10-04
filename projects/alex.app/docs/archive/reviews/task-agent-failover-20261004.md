# Ordinary agent execution after a procedure fails

Date: 2026-10-04. Merged source; the trials below are not deployment evidence.

## Question and decision

Can the Host preserve a failed procedure and let the responsible agent finish
the same Task using ordinary tools, without a recovery queue or a replacement
Task? The motivating incident was a retained Conversation input that the legacy
handler rejected before any model invocation. Repeating that handler could not
diagnose or work around its own input check.

Use the existing attempt history to select ordinary agent execution after a
workflow, executor or CLI attempt fails. Keep the selected agent across partial
progress and restart. A new specification generation selects the authored
procedure afresh. Scheduling eligibility remains separate from handler selection:
backoff, Conditions, owner Stop and cancellation still apply.

This is an execution-path change. It does not authorize new scope or make a
completion claim true. Configured workflow verification still gates completion;
an unavailable contract must not prevent an agent from diagnosing it.
See [attempt selection](../../2a-design/task-attempts.md#selecting-the-attempt-mechanism)
and [the system boundary](../../2a-design/system-boundary.md).

## Real-model trial

The disposable sample App reproduced the exact legacy error:
`Conversation input does not belong to this Task attempt`. Its saved human input
asked for the count and total of accepted records, a saved JSON result, and an
answer. A retained legacy contribution repeated the original input ID and said
to exclude rejected records. Accepted values were 7, 11 and 13; rejected value
100 had to remain excluded.

The trial used candidate Host code, its ordinary Task agent runner and
`gpt-5.6-sol` through the installation's configured endpoint. It used separate
App definitions, database, sessions and files, with no production control socket
or Telegram transport. Running under the container's runtime user provided model
access; this was not an OS-isolated security sandbox. Agent instructions scoped
writes to the disposable trial root.

The first fixture was incomplete: it omitted the App discovery file and loaded
zero agents. No model ran and the procedure kept failing. Adding the discovery
file, the required shared-definition root and an explicit loaded-agent assertion
fixed the harness, without changing production code.

The corrected trial completed in 26.6 seconds:

1. The Conversation handler failed and its attempt was persisted.
2. After the normal retry deadline, the same Task ran through `agent:may`.
3. The agent read the data and exact input context, saved
   `{"count":3,"total":31}`, and read the file back.
4. Its first `finish` proposal contained both `response` and an explicit
   communication message. Existing validation rejected that duplicate delivery
   choice within the invocation; the agent removed `response` and finished.
5. Normal Task communication stored one answer to the original input. That
   inbox item became `done`; both admitted inputs linked to the accepted attempt.
6. The original failed attempt was unchanged. The legacy handler ran once.

The agent completed the request by working around the handler. It did not repair
Host source, and its final facts did not explicitly summarize the remaining
routing defect. The stored failed attempt remains the dependable failure record;
this trial does not prove that an evaluator will independently investigate it.

A second fresh trial completed the same request in 21.1 seconds. A subsequent
human input on that same Conversation asked for the average while preserving
the saved file. It answered `31 ÷ 3 = 10⅓` (approximately `10.3333`), settled the
new input, retained the original failure, and left the file unchanged. The
legacy handler's total invocation count remained one. During the follow-up,
`python` was unavailable; the agent used ordinary tool feedback to continue
successfully within the same attempt. No additional Host recovery path was needed.

The committed Host revision below was then tried again from fresh state. The
original request completed in 41.3 seconds and the follow-up also settled on the
same Task. The agent replaced a missing Python verification command with Node,
and corrected another duplicate communication proposal after `finish` feedback.
Both recoveries stayed within their existing invocation. The saved result and
original failure were preserved; the legacy handler ran only once in total.

## Regression coverage and limits

The portable connected regression recreates malformed retained input through
production input reading and ordinary Task communication. It additionally fails
the first diagnostic attempt, closes/reopens the database, and verifies that the
next attempt remains with the agent, answers once and preserves failure evidence.

Other checks cover partial progress, generation changes, unavailable agents,
workflow contract availability and configured verifier rejection. Fixtures that
only exercised executors now accurately declare that they have no runnable model
agent; Condition fixtures select their configured executor rather than seeding
an unrelated historical agent attempt.

The first completed full CI run passed 3,611 tests and failed three worker-process
restoration tests that expected the old automatic workflow replay. The available
agent instead reached those fixtures' deliberately unavailable model endpoint.
Those tests now provide a local scripted model and assert ordinary agent recovery
through a real child process while retaining the same identity, retry deadline,
failure history and current contract lookup. All 16 worker-process checks then
passed, including the compiled worker. This is protocol and persistence coverage;
the separate model trials above provide the agent-behavior evidence.

Final local `bun run ci` passed on
`162d3616e6e796565e740cad1847f86269666440`: type checks, App-boundary validation,
lint, and 3,614 passing tests with no failures. Three installation-specific
agent-catalog checks were explicitly skipped in portable CI. The complete test
run took 240 seconds. Logs: `ci-final-tests.log`; the earlier failing full run is
retained as `ci-verified.log`. The follow-up commit changes process tests only;
the production code is the revision used in the final model trial.

Review also caught an intermediate candidate mistake: the broader handler
selection rule was reused for scheduling and could make an owner-stopped Task
runnable. A failing regression demonstrated it. Retaining the existing explicit
handoff scheduling rule, separate from fallback handler selection, fixed it.
The regression verifies passive discovery, direct claim, restart, and authorized
new input after Stop. Explicit workflow handoff still selects the agent even
when unavailable, so ordinary failure pacing applies rather than an immediate
loop back into the workflow.

This fallback cannot bypass broken shared storage, Task context, workspace
preparation or the model service itself. Those boundaries still require the
existing independent operational route or an external operator. Stored delivery
in the sample is not proof of live Telegram delivery or repair of May's retained
Conversation. A successful request is not proof that the underlying defect was
fixed.

## Durable failover observation

The follow-up adds `failoverFromAttemptId` to the first agent claim after an
unexpected workflow/executor/CLI failure. The claim transaction saves the exact
source-attempt link before execution. Handler selection continues to use the
existing attempt history; the marker is observation only. An intentional
`needs-agent`/`needs-owner` handoff and later agent attempts do not add switches.

The existing sampler installs `task.failover-count-24h`. Its partial-index query
counts retained marked claims within the rolling 24-hour window and includes
five exact evidence references at most. Ordinary attempt reporting exposes the
same marker and counts. Successful settlement does not remove either failure
or switch. Older unmarked history is unknown. Apps can calibrate an alert using
the existing metric contract; the default observation has no automatic alert.
No new recovery queue, event stream or execution-side counter is introduced.

Portable checks exercise actual claim persistence and reopen, failed claim
storage, continuation after partial progress/failure, missing-agent procedure
retry and deliberate handoff. Reporting tests use synthetic retained attempts,
including startup interrupted before a result, subsequently successful work,
other Apps, and out-of-window records. They follow each sampled source link
through the public attempt reader and verify the partial index is used.
Repeated samples are quiet; an App-defined threshold emits one breach across
successive measurements. Startup preserves that App calibration and retirement.

The first focused run passed 51 tests and failed one test expectation: the
existing metric reader represents no observation as `null`, not `undefined`.
Correcting that fixture assertion made both new reporting tests pass. Production
logic was unchanged by that correction. These checks prove collection and the
existing breach boundary, not independent evaluator follow-through or deployment.

Full local `bun run ci` then passed on
`1d586318fb5f1c48f32743fc2f52bbb356e24cc1`: type, SDK, boundary and lint checks,
3,617 passing tests, three explicit installation-specific skips and no failures.
The test run took 290.44 seconds across 327 files. Evidence log:
`ci-failover-metrics.log` under the same local evidence directory.

The discussion also clarified the execution policy: when an agent is available,
the merged implementation switches on the first procedure failure after the existing
retry delay. It does not try the same procedure once more before switching. This
can cost an agent invocation for a transient failure. Without an available agent,
ordinary paced procedure retries remain. The marker and metric are independent
of that policy and would also record a later switch if retry policy changes.

## Reproduction and source

Host [PR #325](https://github.com/hao1939/may-agent/pull/325) merged as
`d8c87757782ae5750984bedc239b00eab4c76715`; both GitHub checks passed on the reviewed
revision. The companion design and this evidence record now live under
`projects/alex.app/docs` following the separately merged Alex migration.
The local deployed bundle still identified `fc3b9cab3` when this merge was checked.
Source merge alone does not establish rollout or live recovery.

Host base: `fc3b9cab31d3b3af40ee04453b689a93e0477832` (#324).
Host candidate: `cf1920e3f726fc77d2c7cc43a9a8685b0fde4d17`.
Candidate branch: `fix/task-agent-failover-20261004`.
[Host PR #325](https://github.com/hao1939/may-agent/pull/325) includes the
follow-up process-test and metric changes. The execution policy is the model-tested
revision; the later metric addition is validated by portable persistence/reporting tests.
Design branch: `design/task-agent-failover-20261004`, based on
`64b901d1e4c95a385c4f1d633bbbbe9a99d6f367`.

Portable checks, from the Host checkout:

```sh
bun test src/app/core/tasks/task-communication.test.ts \
  src/app/core/tasks/app-task-retry.test.ts \
  src/app/core/tasks/app-task-runtime.test.ts \
  src/app/core/tasks/app-task-reconciler.test.ts
bun run ci
```

The model harness and raw evidence remain local under the ignored
`.state/conversation-recovery-live-20261004/` directory (`model-trial.ts`,
`model-1.log`, `model-2/result.json`, `model-2.log`, `model-3/result.json`,
`model-3/follow-up.json`, `model-3.log`, `model-4/result.json`,
`model-4/follow-up.json`, `model-4.log`, `stop-before.log`). A repeat needs separately
authorized model access. Recreate the portable regression's retained input with
the real managed-agent backend, a disposable root and the synthetic data above;
verify the persisted answer, exact input settlement and unchanged failed attempt.
Do not point the harness at production state.
