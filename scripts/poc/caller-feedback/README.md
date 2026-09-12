# Caller feedback while waiting — mechanics PoC

Experimental branch rebased onto Host `38a048da` (#167); the original trials
used `8026aff9`. This is not a released SDK contract.
The design proposal is maintained in the companion App's canonical docs:
`docs/proposals/caller-feedback-and-waiting.md`.

```sh
bun install --frozen-lockfile
bun test src/app/core/tasks/app-task-runtime.test.ts --test-name-pattern 'caller feedback PoC'
bun test src/app/core/state/conversation-task-turns.test.ts src/app/core/tasks/conversation-runtime.test.ts src/app/core/tasks/app-task-runtime-policy.test.ts
bun test src/app/core/tasks/app-task-retry.test.ts
bun run ci
```

The experiment reuses the runtime test's temporary App and file-backed SQLite
fixtures. Scripted executor decisions isolate mechanics; no model, credentials,
installed App, external provider or human transport is used. In the six original
Task-to-Task scenarios, automatic controllers are disabled. Tests drive real reconciliation, saved-feedback recovery and the
production Condition tracker explicitly, including database/runtime reopen.

Candidate changes:

- `waiting` may explicitly report its existing summary/evidence with `report: true`.
- Failed execution can supply a factual caller report without an accepted agent result.
- First failures remain quiet on retry; an explicit waiting report can select a newer update.
- One report revision on the existing input/Condition prevents duplicate or stale delivery.
- Answers, Conditions and Task closure retain separate meanings.
- Conversation discovery and live admission select the same saved report, including
  waiting updates and execution failures. Answer or closure suppresses new admission
  of an old report. Already admitted input stays in Conversation history.
- Compact agent guidance explains reporting without turning a Condition into a message.

Six scenarios compare quiet wait, existing stop-then-wait, combined report/wait,
thrown failure, invalid output and failure followed by an actionable wait report.
All require the original answer after lost notification and storage reopen.
They also check quiet recovery, mismatched wake facts, unaccepted proposed effects
and delayed older feedback. Assertions sit outside executor callbacks so runtime
failure containment cannot turn an assertion failure into a passing experiment.

The combined path needs two worker attempts versus three for stop-then-wait in
the fixture. Ten recovery probes during 100 seconds of controlled time produce
no worker rerun before the five-minute checkpoint. These are mechanics counts,
not measured model cost, real-time latency or long-outage performance.

Conversation tests also exercise automatic controllers, human-event admission,
actual reply storage and exact repair-event routing. A waiting report survives
runtime/database reopen; the original Task later answers and the Conversation
fulfills the original Request. State checks cover delayed/duplicate reports,
lost notification, selected-report replacement and answer/closure precedence.
These are scripted judgments, not language-model or transport-delivery proof.

For a separately authorized live-model trial, reuse the existing managed harness:

```sh
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/caller-feedback-development --fault caller-feedback
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/caller-feedback-transfer --fault caller-feedback --value 0.78
```

It uses the configured model endpoint, two temporary Apps, a read-only measurement
tool and the normal managed execution path. The human explicitly asks for the
measurement App, but models choose delegation details, report/wait, replies and
Request fulfillment. After a communicated access problem, the fixture reopens
storage/runtime, restores its synthetic source and supplies both ordinary human
input and the source's exact access-restored fact. It checks the original input's
answer after a second reopen, without replacing or cancelling the worker.

Limits are 180 seconds, eight Conversation calls and 24 model-stream starts;
they are fixture limits, not product retry policy. `report.taskAttempts` includes
worker and Conversation attempts; top-level `calls` counts only Conversation
calls. Review the actual comparison and wording as well as the mechanical gate.
Keep raw transcripts/configuration private. This does not test natural selection
of delegation, arbitrary provider errors, process-kill recovery or installed May.

The main integration keeps the shared failure transition and its evidence/retry
semantics. Focused checks ensure a workflow handoff stays quiet and a subsequent
agent failure reports without accepting an answer. New input received during
execution is not assigned that attempt's report; repeated failures preserve the
first report for each considered input. The Condition-owner schema also matches
admission so malformed owners can be corrected before finish ends an attempt.

Do not deploy this prototype as-is. Canonical Task design corrections and remaining
promotion gates are recorded in the proposal. Explicit updates are
limited to waiting results. Latest selected report can supersede undelivered
earlier feedback; this is not delivery of every intermediate update. Process
death, all failure boundaries, concurrent publication/closure and natural agent
adoption beyond these bounded fixtures require further evidence before promotion.
