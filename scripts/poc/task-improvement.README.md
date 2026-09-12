# Guidance improvement through an ordinary Task

Opt-in extension of [the direct improvement experiment](agent-operated-improvement.README.md).
No production runtime change, installation operation, or learning controller.

## Recommendation

Use one ordinary App-owned Task for an improvement that needs its own
follow-through. A small correction can finish in the current Conversation Task.
The agent chooses edits and probes; existing code preserves work, enforces
scoped effects and returns evidence. Do not give each edit/probe a new Task or
install these fixture tools as a production improvement API.

```text
one Task -> author candidate -> wait -> reopen -> same Task resumes
         -> activate exact candidate -> check fresh target -> return result
```

`converged` accepts the result but leaves the Task open. Its assigning owner
decides closure or withdrawal. Keep committed source, active source, actual
target revision and useful behavior distinct; none proves the next by itself.

## Run

```sh
bun scripts/poc/task-improvement.ts
bun scripts/poc/task-improvement.ts --withdraw
# These two spend model tokens using the configured gpt-5.6-sol route:
bun scripts/poc/task-improvement.ts --live
bun scripts/poc/task-improvement.ts --live --withdraw
```

The fixture installs an ordinary App-owned Task with real admission, controller,
SQLite, managed execution and result projection. The agent discovers synthetic
accepted policy, authors guidance and decides to wait for an external activation
window. The fixture reopens the Task runtime/store, then emits the window fact.
The agent resumes, requests real temporary-daemon reload and checks fresh target
behavior. Four holdouts remain hidden until the improver finishes.

The withdrawal arm instead applies an owner cancellation before activation.
It verifies a late wake cannot restart that Task and cancellation survives another
reopen. Committed source is retained, not activated or deleted.

## Scope and limits

- Only synthetic target guidance is writable. Policy truth, target tools and
  permissions cannot be changed through the fixture capabilities.
- The target cannot edit guidance or policy. Its standard finish tool can
  append reported lessons as private fixture evidence; that evidence is neither
  readable target context nor automatically loaded guidance. The shared
  no-model preflight checks this narrower promise, not a blanket "read-only" claim.
- The Task runtime restarts gracefully in process. The temporary source daemon
  stays running. Targets are direct fresh executions, not subprocess Task workers.
- The external window is fixture control, not a production approval service.
  Owner closure tests the control operation, not a human's acceptance judgment.
- At most two improver attempts, five selected target probes, four holdouts and
  one baseline: twelve model executions. Each improver attempt is bounded to
  300 seconds, each target to 60 seconds. Up to forty improver provider requests
  are counted across runtime reopen; this is not production spending policy.
- No-model mode substitutes scripted provider replies, not Task results. The
  actual managed loop reads/writes guidance, commits, encounters the closed
  activation window, finishes with a wait, then resumes and reloads. It proves
  mechanics and binding, not agent judgment or useful target behavior.
- Both `results.json` and `task-trial.json` matter. The latter covers Task
  mechanics; the former includes independent final behavior checks. Temporary
  artifacts are retained for review, not publication.
- Task runs retain their actual prepared system prompts and tool names in
  `task-trial.json`; their aggregate entry does not claim the unused direct
  prompt. Each execution retains its own messages.
- `forwardedReloadCalls` counts calls passed to the reload adapter, including
  its injected rejection, not successful activations. Source and target evidence
  in `results.json` establish activation and behavior separately.

The Host deliberately rebuilds standard `read`/`write` tools for a Task workspace.
Cross-target fixture capabilities therefore use `fixture_read`/`fixture_write`.
Preparation-time checks verify their restrictions survive the real tool binding.
Do not register a constrained adapter under a reserved coding-tool name and
assume its implementation survives workspace rebinding.

Task recovery also profiles no-op wait checks. The harness waits for distinct
actual attempt IDs, not arbitrary profiling events. The preflight exercises a
real redundant wake while waiting to retain that regression.

Readiness uses the fixture's exact fact fields and predicate. An optional
`requestedAction` description may differ; it does not execute an action or
change readiness. No-model checks reject altered/wildcard Conditions through normal
result admission and publish false-predicate and wrong-subject facts before a
no-op wake. Neither may start the next attempt. Source checks compare the
committed candidate and active revision before and after reopen/withdrawal.
The original input must return the accepted summary, response and result
payload; the scripted success payload is exactly `{ accepted: true }`.

## Observed trials (September 12, 2026)

The positive live trial completed twelve model executions. One Task/generation
retained its candidate and wait across reopen; a second attempt activated it,
handled an explicit pre-submission reload failure and chose five passing probes.
All four holdouts passed. Both improver attempts and all nine post-change target
executions had zero tool errors. One scoped nine-line guidance addition remained.

A separate live withdrawal trial completed baseline and one improver execution.
The agent committed a candidate and waited. Owner cancellation blocked later
execution and no reload was forwarded to the source adapter.

Unsuccessful evidence is retained too: an initial mechanical fixture bypassed
Condition observation; an interrupted live fixture lost its constrained adapters
through standard-tool rebinding; a subsequent live fixture confused a no-op
profile with the second attempt. These led to harness fixes, not production
special cases or policy changes.

These are small usability experiments, not reliability statistics. They support
one ordinary Task plus scoped capabilities, without proving abrupt crash safety,
mid-effect cancellation, changed-owner-input handling or installed authority.
The separately maintained App proposal owns the recommendation and sanitized
evidence: `docs/proposals/task-improvement-poc-20260912.md`.

The successful live trials used these harness SHA-256 hashes:

- Task harness: `1459afa9a2e40254439f7e6e626fe0084c98d5352c0e25b61f47a1db2dd2e59c`.
- Shared direct harness: `475de2497bdfbc45ca4ce2d02adff6f5e6758665db3135e5fe6a6fd6ca157f92`.

Later publication refinements have no-model coverage, not another live trial:
five-probe budget advertisement; exact input/result and one-Task assertions;
a real no-op-wake regression; the 300-second limit at actual managed dispatch;
final-commit/active-source equality; and truthful reload-call naming. Earlier
live attempts finished within 48 seconds, but did not test the revised timeout.
Old raw reports retain the former `activations` field; its value counted calls,
including the rejection, and must not be read as successful activations.
