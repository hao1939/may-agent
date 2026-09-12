# Guidance improvement through an ordinary Task

Opt-in extension of [the direct improvement experiment](agent-operated-improvement.README.md).
No production runtime change, installation operation, or learning controller.

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
- The Task runtime restarts gracefully in process. The temporary source daemon
  stays running. Targets are direct fresh executions, not subprocess Task workers.
- The external window is fixture control, not a production approval service.
  Owner closure tests the control operation, not a human's acceptance judgment.
- At most two improver attempts, five selected target probes, four holdouts and
  one baseline: twelve model executions. Each improver attempt is bounded to
  300 seconds, each target to 60 seconds. Up to forty improver provider requests
  are counted across runtime reopen; this is not production spending policy.
- No-model mode scripts judgment only. It verifies real lifecycle mechanics and
  effective tool restrictions; it does not prove agent judgment or target adoption.
- Both `results.json` and `task-trial.json` matter. The latter covers Task
  mechanics; the former includes independent final behavior checks. Temporary
  artifacts are retained for review, not publication.

The Host deliberately rebuilds standard `read`/`write` tools for a Task workspace.
Cross-target fixture capabilities therefore use `fixture_read`/`fixture_write`.
Preparation-time checks verify their restrictions survive the real tool binding.
Do not register a constrained adapter under a reserved coding-tool name and
assume its implementation survives workspace rebinding.

Task recovery also profiles no-op wait checks. The harness waits for distinct
actual attempt IDs, not arbitrary profiling events. The preflight exercises a
real redundant wake while waiting to retain that regression.

## Observed trials (September 12, 2026)

The positive live trial completed twelve model executions. One Task/generation
retained its candidate and wait across reopen; a second attempt activated it,
handled an explicit pre-submission reload failure and chose five passing probes.
All four holdouts passed. Both improver attempts and all nine post-change target
executions had zero tool errors. One scoped nine-line guidance addition remained.

A separate live withdrawal trial completed baseline and one improver execution.
The agent committed a candidate and waited. Owner cancellation blocked later
execution and there were zero reload calls.

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
