# Caller feedback while waiting — mechanics PoC

Experimental branch based on Host `8026aff9`, not a released SDK contract.
The design proposal is maintained in the companion App's canonical docs:
`docs/proposals/caller-feedback-and-waiting.md`.

```sh
bun install --frozen-lockfile
bun test src/app/core/tasks/app-task-runtime.test.ts --test-name-pattern 'caller feedback PoC'
bun run ci
```

The experiment reuses the runtime test's temporary App and file-backed SQLite
fixtures. Scripted executor decisions isolate mechanics; no model, credentials,
installed App, external provider or human transport is used. Automatic controllers
are disabled. Tests drive real reconciliation, saved-feedback recovery and the
production Condition tracker explicitly, including database/runtime reopen.

Candidate changes:

- `waiting` may explicitly report its existing summary/evidence with `report: true`.
- Failed execution can supply a factual caller report without an accepted agent result.
- First failures remain quiet on retry; an explicit waiting report can select a newer update.
- One report revision on the existing input/Condition prevents duplicate or stale delivery.
- Answers, Conditions and Task closure retain separate meanings.

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

Do not deploy this prototype as-is. Topic-linked Conversation discovery and
managed-agent protocol guidance are not yet aligned. Explicit updates are
limited to waiting results. Latest selected report can supersede undelivered
earlier feedback; this is not delivery of every intermediate update. Process
death, all failure boundaries, concurrent publication/closure and natural agent
adoption require additional review and evidence before promotion.
