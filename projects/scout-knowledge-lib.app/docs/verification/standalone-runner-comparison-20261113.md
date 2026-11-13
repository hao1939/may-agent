# Scout: standalone runners and source-command execution

**Date:** 2026-11-13. **Status:** local comparison completed; the selected async
command helper is implemented in App source and verified locally. No deployment
or runtime restart was performed. The comparison below describes the pinned
baseline; [implementation verification](#implementation-verification) records
the follow-through.

## Decision

Use the existing standalone workflow runner to exercise reusable procedures
without starting the Host. For Scout's fixed XHS commands, prefer a small
App-local asynchronous subprocess helper inside the existing workflow.
These address different responsibilities and can be used together. Do not add
another workflow or a model-controlled agent merely to execute `prepare`,
`status` or `search`.

The comparison supports this command-level choice. It does not establish that
all Scout or MLVM work should move out of the Host. Standing work still uses its
Task owner, scheduling, Conditions, accepted results and recovery.

## Options and actual behavior

| Option | What the trial established | Complexity consequence |
| --- | --- | --- |
| Call the current XHS search helper directly | The parent could not respond while the synchronous child was running. | Existing process handling needs a change. |
| Put that unchanged helper inside `runDirectWorkflow` | The same parent responsiveness problem remained. The runner invokes workflow JavaScript in the caller's process. | A workflow invocation does not replace subprocess cancellation or output bounds. |
| Use an async subprocess helper, directly or inside `runDirectWorkflow` | The parent responded while the child waited. Explicit cancellation stopped the child and prevented the next authored action. | One small helper can own process execution; existing parsers and workflow gates retain their roles. |
| Ask `runDirectAgent` to execute the command | The real agent runner executed the command and finished through a scripted local provider. This fixture made two provider requests. | Adds a prompt, model interaction, tool selection and an agent result to a fixed operation. Provider output still needs domain checks. |

The standalone workflow path needs no model when the procedure does not call
one. Its value is running and observing the whole procedure through the shared
kernel, rather than wrapping each deterministic helper in another execution.
The agent path remains appropriate for the research and judgment step already
inside Scout's workflow. Two scripted provider requests are an observed fixture
sequence, not a measured live-model cost or a universal request count.

## Evidence

Source pins:

- Apps baseline: `e56d465868e0640ff80b02759fb8c54a04bc7f74`.
- Host: `2dd58ba3e31cffe56c080f518ad733a63a05dfbc`.
- Retained experiment: local Apps commit `928220559b` on
  `experiment/scout-standalone-runner-20261113`, containing
  `scripts/scout-runner-comparison.test.ts`. The harness is kept on that branch,
  outside the current source/test surface.

Fourteen experiment checks passed, with 56 assertions:

- Both the plain and standalone-workflow callers used the actual existing
  `searchXhs`. A child announced readiness, then waited for a parent release
  marker. Both reached the child's fallback because the parent could not run
  its callback. The async candidate let both callers release the waiting child.
  These are synchronization checks, not command-speed benchmarks.
- With the unchanged search, cancellation requested by that parent callback
  could not be delivered during the search, and the next authored action ran.
  With the async candidate and explicit `ctx.signal`, cancellation was delivered,
  the later action did not run, and the child was confirmed stopped.
- The candidate retained the same structured provider failure from stderr and
  exit code 2 as the existing helper. It bounded stdout and stderr separately
  at the trial's 256-byte cap, killed overflowing children, and stopped a stuck
  child at a real 30-second command deadline. These bounds were tested on the
  candidate helper, not inferred from the workflow runner's limits.
- The actual `executeScoutExplore` ran through `runDirectWorkflow` with a local
  assignment snapshot and fixture browser script. An empty discovery returned
  an evidence-backed no-op. Missing assignment context returned blocked.
- A nonempty fixture discovery invoked one scripted researcher, wrote a
  candidate note, passed the existing publisher, and returned its canonical
  path and Git revision. Git read-back matched the published bytes. Login
  produced a waiting result; provider failure and an empty extraction despite
  visible identities remained blocked. None of those three invoked research.
- The actual `runDirectAgent`, using only a loopback scripted provider, ran the
  same failed fixture command through `bash`, observed its output, called
  `finish`, wrote its session evidence and confirmed cleanup. A successful agent
  execution here means it completed the inspection; it does not turn the
  provider's failed command into successful source acquisition.

The Host's owning `direct-workflow.test.ts` and `direct-agent.test.ts` also
passed: 16 checks, 75 assertions. Their fixtures cover shared nested-call limits,
tool policies, finish contracts and unconfirmed cleanup.

No live source, external provider, production Task, browser session, scheduler
or deployment was used. The researcher and provider were scripted fixtures.
This verifies mechanics and contract compatibility, not research quality,
live-model latency, deployment reliability or MLVM acceptance.

## What this means for the design

Preserve the reusable workflow. It still owns the stable sequence: verify
access, acquire source evidence, call Scout for judgment, validate the candidate,
publish, and return exact evidence. The standalone runner successfully reused
that sequence, including publication, without a second procedure implementation.

The runner supplies execution context and limits, not preemption of arbitrary
synchronous code. Authored I/O must receive its signal. A kernel can fence a late
return but cannot undo an effect already performed. Process exit must be observed
at the subprocess boundary; an abort callback alone is not proof of child exit.
The trial explicitly awaited child closure. It does not claim that a runner's
cleanup report tracks arbitrary processes created by App code.

Scout currently requires `workspace` and `reconciliation` even for this bounded
procedure. Explicit local snapshots made standalone verification possible; they
do not grant production Task identity, live Condition observation, result
acceptance or closure authority. A future general one-shot Scout entry should
take an explicit assignment and let the hosted adapter supply that assignment
from its Task. Do not fabricate a production Task or build another owner ledger
just to call the standalone runner. That extraction is deferred until a real
one-shot caller needs it.

The direct runner is already used by Gym through a deliberate Host-source
adapter. Ordinary Scout production helpers should not import Host-private
`src/app/direct-workflow.ts` merely to launch a Node script. They continue to
use the SDK authoring contract and App-local deterministic helpers.

## Selected implementation

The [App-local helper](../../agents/scout/tools/lib/xhs-command.ts) now shares
only the `node xhs-browse.mjs` execution mechanics between status, preparation
and search. Node's asynchronous `execFile` supplies 1 MiB limits per output
stream, the existing 30-second status/preparation and 60-second search ceilings,
and `SIGKILL` on cancellation, timeout or overflow. The helper waits for child
closure before returning; cancellation propagates as a control failure rather
than a domain result. The workflow passes its signal to preparation and search,
awaits search, and checks cancellation before accepting source results, starting
research and publishing a returned candidate.

Keep output parsing operation-specific. Preserve nonzero structured failures,
read-only observer status versus tab-restoring preparation, supported human-login
waits, partial search evidence and the failed-extraction gate. Do not create a
generic cross-App process service, nested command workflow or retry framework.
These are the existing boundaries of the selected implementation. The experiment
prototype remains on its retained branch; production uses the focused helper and
regressions in the owning App. The existing browser session is not killed, and
already completed synchronous publication effects cannot be undone by cancellation.

## Implementation verification

Implemented from Apps baseline `b2315dc226`. The same pinned Host SDK source
was used for local verification, without replacing the installed runtime SDK.

- 107 tests passed across the five owning command, credential, parser, observer
  and Scout exploration test files: 370 assertions. This includes the real
  30-second credential and 60-second search deadlines, subprocess cancellation
  and exit confirmation for all three commands, independent stdout/stderr
  overflow, exact query argument passing and structured provider failure.
- Workflow regressions cancel while actual preparation/search children are
  waiting, verify that research/publication never start, and reject late results
  from dependencies that ignore cancellation. A changed candidate returned by
  late research is preserved without a canonical write or Git publication.
  Existing successful publication, login-wait, failed-extraction and recovery
  checks also pass.
- Strict TypeScript checking passed for the changed implementation and focused
  command/credential/parser/observer tests. Including the larger existing
  `scout-explore.test.ts` reports 14 diagnostics. Comparing their codes and
  messages against the unchanged baseline produced identical diagnostics; this
  change adds none. This is not a claim that the full existing test file is
  type-clean.
- The App design, SDK examples, canonical-App and model-surface checks passed,
  with the existing unclassified `reports` root-layout warning.

All new runtime evidence comes from temporary local scripts/repositories;
no live browser, source, Task, provider, publication or deployment was used.

## Reproduction

Use an isolated Apps worktree at the retained experiment commit and a separate
Host checkout at the pinned revision. Install each checkout's declared
dependencies, and make the Host checkout available at the experiment worktree's
ignored `projects/may-agent` path. Do not reuse a live runtime directory or modify
its installed SDK. From that Apps worktree:

```sh
SCOUT_RUNNER_TRIAL_RESULTS=/tmp/scout-runner-results.json bun test --tsconfig-override projects/may-agent/tsconfig.json ./scripts/scout-runner-comparison.test.ts --timeout 45000
```

From the pinned Host checkout:

```sh
bun test src/app/direct-workflow.test.ts src/app/direct-agent.test.ts --timeout 45000
```

The experiment creates and removes temporary browser scripts and Git
repositories, and uses an ephemeral loopback HTTP server for the scripted
provider. The results file records synchronization, bounds, publication and
agent-run observations. Fixture paths and publication revision vary per run.
The Bun 1.3.14 external-tsconfig directory diagnostic was emitted; both test
commands completed successfully.
