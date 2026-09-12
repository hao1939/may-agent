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

## Consolidated review follow-up

#165 was merged into #163's branch; #163 is the single PR against main.
Fresh model trials at `256006c2` rejected valid waits because the fixture compared
the entire Condition, including an optional `requestedAction` description. Each
trial completed two model executions without activation. Those failures remain
retained. The validator now fixes the readiness fields/predicate, not the agent's
explanation; scripted managed execution covers both that permission and rejection
of real predicate changes.

At `2c9e9d6c`, resumed improvement completed twelve model executions with four
correct holdouts, and withdrawal completed two with the exact inactive candidate
retained. Actual Task prompts and input payloads were checked. The resumed agent
hit the existing probe allowance and honestly reported an untested case; one
target also made a refused relative shared-file read. These are retained
imperfections, not hidden by the correct answers.

The read failure exposed a fixture-root mismatch. `7f2abb05` aligns the target's
prompt and relative reads with its immutable source. A regression verifies
`shared/common-sense.md` is readable there while the mutable source is still
denied. The final live resume trial completed **eleven model executions**: two
improver attempts, four chosen probes, four holdouts and baseline. All holdouts
passed at the exact final revision. Both improver attempts and all eight
post-change targets had **zero tool errors**. The baseline still had 23 failed
discovery reads, so this is not a general lookup-efficiency claim.

The final Task harness hash is
`8748803480035e9c10e956b55f9f7cd4d9d4f5a06ec865f936a65ce037b20dcd`;
the final shared harness hash is
`a5186659a5c9162af73eb16254329fc51bf5743044e1f777cf3c940e2e6fa203`.
Withdrawal used the same Task harness at `2c9e9d6c`, with the earlier shared
harness `da8c5eb52689d3351ad7c0a175aa20d132216444303fb1f261e0eba336da9a73`.
No production change, new learning controller, general reliability or crash
safety is claimed. Detailed sanitized review evidence remains with the App
proposal at `docs/proposals/evidence/task-improvement-review-20260912.json`.
