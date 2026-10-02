# Reachable feedback and honest source promotion

**Supports:** [Teaching agents: from a correction to dependable behavior](agent-behavior-and-capability-extension.md). Makes improvement feedback reachable and distinguishes source preparation from activated behavior.

**Choice basis:** [Applicable philosophy and convention](../1-principles/evolution.md#promotion-tests); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Isolated source candidate, four feedback model checks and the
ordinary-Task and linked-Gym follow-ups below, September 12, 2026. Not merged into
installation source, activated or deployed. Unsuccessful trials remain evidence.
**Parent:** [Agent-extension proposal](agent-behavior-and-capability-extension.md).

## What changed

The [method investigation](extension-methods-poc-20260912.md) found that saved
feedback could be missed, and an approved source copy could look like completed
adoption. This slice fixes those two misleading boundaries without adding a
learning framework or granting Gym deployment authority.

### One feedback location, owned by Evaluation

Evaluation now writes `generated/agent-feedback/<key>.md` in its own shared
App workspace. Existing shared agent guidance already points there. Normal
agent names map directly; unusual identities retain the App's safe key in the
feedback Task input. There is no agent-directory scan, hardcoded agent-to-App
map or cross-agent `last-eval.md` write.

An unloaded agent does not prevent evidence from being saved. Projection is
not delivery to a running agent or acceptance of remediation work. Summaries
and the generated file now say saved/read-back verified, with reading and
remediation unverified. The text asks the reader to assess the critique, not
treat it as permission to edit standing instructions or abandon current work.

An issue-free latest evaluation clears the projection. Stale replay protection,
explicit corrected replay, safe filenames and read-back checks remain. Old
agent-local files are untouched; this is not a data migration. Durable Evaluation
facts remain authoritative, and no standing guidance or credentials changed.

### A source copy is not completed adoption

Gym still requires the exact candidate fingerprint and existing approval before
copying an agent overlay. After the copy it now records `activation_status:
unverified` and leaves the same campaign at existing owner attention. It does
not mark that track complete. Its `agent.revision.changed` fact carries the same
qualification and does not trigger another training cycle by itself.

The existing result verifier rejects a premature converged claim while this
checkpoint needs owner action. Replaying the recorded result does not copy the
candidate again; a test preserves a newer owner source edit across that replay.
Benchmark/scorer-only approval behavior is unchanged.

**This does not complete automatic activation.** An authorized operator still
needs to commit/reload through the existing path and verify the active revision
and a fresh relevant execution. The source-only fact is not confirmation. This
slice deliberately leaves adoption pending instead of inventing another
activation controller, treating another approval as proof, or allowing Gym to
deploy. The precise completion handoff remains a later integration step.

The pre-existing overlay copy is not a transactional deployment or a
concurrent-source-edit guarantee. Replay after a recorded result is covered;
crash during copy/publication and source drift before first application still
need the owning activation boundary's evidence before production adoption.

## Four model checks through the real projection

The new harness invokes Evaluation's real input mapping and projection, then
May's real definition preparation, execution and confined read tool. It uses
the current shared section containing the feedback reference and adjacent
defaults, not an injected feedback body. The evidence preserves that exact excerpt.
One definition/source revision remains active throughout. Each probe is a
fresh direct-runner execution without previous conversation history.

The fixture supplies separate approved Orion policy files. Feedback points to
the relevant policy; it is not itself the policy or permission to deploy.

| Condition | Observed result |
| --- | --- |
| No generated feedback | Agent attempted the normal feedback path; calculated 39 slots but reported the policy unavailable. |
| Real projection saved feedback | Agent read the generated file, followed its v1 reference and correctly rejected 39 against the production limit of 37. |
| Real projection replaced feedback | Without reload, agent read the replacement and its v2 reference; correctly rejected staging demand 13 against 12. |
| Real projection cleared feedback | Fresh execution no longer found the reference and honestly reported the staging limit unavailable. |

All four completed on the configured `gpt-5.6-sol` route with fallback disabled,
90-second deadlines and no retries. Total reported execution time was about
52 seconds. No permanent guidance edit or deployment operation was available.
The [sanitized evidence](evidence/feedback-adoption-20260912.json) retains every
input, projection outcome, answer, tool call, prompt and reported usage.

This proves a useful ordinary read path for changing operational evidence. It
does not prove a daemon/Task wake, old-session forgetting, autonomous improvement
or installed production adoption. The policy references deliberately change;
this is not learning new model weights.

Selection was imperfect. The agent unnecessarily read a PR-review skill in
three cases, and guessed many paths when the feedback reference was absent.
The fixture has a read tool but no directory listing. Keep these costs visible;
do not claim optimal discovery, a general speed gain, or blanket reliability
from four controlled observations. The successful feedback path needs no new
always-loaded prompt body or semantic routing service.

The trial uses the ordinary agent name `reviewer`. Source tests cover safe
storage for unusual identities, but do not prove an agent can discover its
hashed feedback key from the generic `<you>.md` instruction. That lookup remains
unverified; safe storage alone is not proof of reachability for every identity.

## Ordinary Task follow-up: activation is an execution boundary

The next trial used a temporary real daemon and one ordinary App Task,
`sample/work/capacity`, through its normal input, exact owner comments,
Conditions, isolated workflow workers and bounded agent calls. The fixture
operator committed an authorized Orion staging rule; the agent did not author
this change. This tests adoption through work, not the complete Gym approval
and activation handoff.

The final source was the existing [Host #158](https://github.com/hao1939/may-agent/pull/158)
candidate `94864da1`. Its reload observer came from the isolated teaching
harness at `dbb39fee`; no production Host change or new controller was added.
The experiment is App commit `20baad01d6`, with exact hashes in the
[sanitized evidence](evidence/task-guidance-adoption-20260912.json).

### Keep the unsuccessful timing arm

A fast no-model preflight passed, but the first model-backed trial did not
establish adoption. Its second execution still used the old definition after
reload reported success. Both model executions completed; the experiment
stopped on the source/adoption assertion and did not run its third case.

Earlier no-model tracing on the older Host showed extra worker dispatches
before reload publication, including repeated inbox attachments and overlapping
Condition/exact-target wakes. An already-dispatched worker pins its source;
it can start claiming later input after the global source link changes. The
current candidate passed the fast control, but the longer model-backed case
still exposed old-source execution. Those observations do not isolate every
extra-dispatch cause on the current candidate.

This is not evidence that a new rule was available to the model and ignored.
The workflow's own recorded source was old too. Nor is a displayed waiting
Task proof that no worker is already starting. Do not fix this by assuming
another approval, killing all workers on reload, or calling every subsequent
input a fresh execution.

### A genuinely fresh dispatch used the change

The second arm explicitly observed prior temporary Task-worker exit through
Linux `/proc` before advancing. This is fixture synchronization, not a new
production interface or proof of an atomic system-wide idle barrier. Recorded
execution-source checks remain the acceptance evidence.

| State | Fresh execution result |
| --- | --- |
| Rule committed, not reloaded | Computed demand 13; reported the missing policy and unknown eligibility. |
| Rule activated by successful reload | Used the scoped limit 12 and correctly rejected demand 13. |
| Invalid replacement committed; reload rejected | Kept the previously active limit 12, not the rejected limit 60. |

All three calls used `gpt-5.6-sol` and completed. The same Task and generation
1 remained throughout; four attempts include the initial no-model wait. The
last result was accepted and the Task retained. No owner-close operation was
requested. Sessions were distinct executions, with actual Task bindings.

Across both arms there were **five model executions**, no automatic retries.
The successful arm's recorded session times were 14.2, 5.4 and 4.9 seconds;
this is not a speed comparison. When policy was missing the agent queried
Task state repeatedly and needed a corrected finish call. Useful adoption
does not establish optimal discovery or perfect execution efficiency.

The explicit TypeScript check and no-model preflight pass. On exact Host
`94864da1`, **14 existing worker/restart tests pass** across two files. No
whole-Host CI, compiled-image trial or installed deployment was run for this
follow-up. The daemon used source execution; the tested workflow's source
inspection is experimental instrumentation, not an SDK instruction to App authors.

### Refine the contract, not the number of controllers

Say “activated for newly dispatched executions,” not “every next message
already uses it.” Existing work may still be using the previous snapshot.
For adoption evidence, bind the source revision to the actual relevant
execution and accepted Task result. Keep the same Task through that wait.
Publication, the worker's selected source, useful behavior and owner closure
are separate facts.

The experiment does not certify immediate post-reload adoption, restart of
this particular model-backed Task, installed operator authority, cross-agent
promotion, or Gym's source-only checkpoint completion. Preserve the unsuccessful
arm instead of treating the settled arm as a fix for all timing cases.

## Linked Gym follow-up: reuse the existing return path

The next no-model daemon trial connected Gym's real exact-approval/copy code
to the same capacity Task using an ordinary App dependency. It found a real
execution defect before proving the return path. The
[sanitized evidence](evidence/gym-task-handoff-20260912.json) retains both the
failure and the final exact-head trial.

### Fix the effect record before adding handoff behavior

The approved files were copied, then the Host rejected `agent.revision.changed`:
“Task-owned workflow events require a stable localKey.” Gym's generic error
checkpoint no longer said that the source had been applied; a replay then
reported that the approval did not match. The copied file was still present
with the exact candidate content. This was an App event-contract error, not an
agent ignoring guidance or a failed benchmark.

Local fix `a74d63fd6c` makes that source-change event use a stable key derived
from the exact approval. It records the completed copy and its `source_approval`
before publishing the observation. A publication outage remains visible as
owner attention with activation unverified. Redelivering that exact approval
returns the existing result without reconstructing the benchmark plan,
recopying the overlay, or overwriting a newer owner edit.

This is not an atomic filesystem-copy/checkpoint transaction or an event
redelivery service. A crash during the copy remains a separate boundary. The
source-change fact is observation, not the activation trigger; this fix does
not add a background publication queue.

### What the connected trial proves

App source `9b3a722e0c`, including the fix, ran against Host `94864da1`. A small
fixture owner adapter used the existing `dependencies` result and
`ctx.read.appResult()`; it did not add a Host controller or public API.

1. A **seeded benchmark checkpoint** supplied one exact approval. The real Gym
   code checked and copied that artifact. Benchmark execution was explicitly
   disabled; this trial does not prove that the candidate improves a benchmark.
2. The fixture adapter kept `gym/improve/may` waiting on the existing
   `sample/work/capacity` Task. The fixture operator committed and reloaded only
   the temporary source, not the installation.
3. The capacity Task observed old source before reload, new source after a
   successful reload, and the retained source after a rejected replacement.
   Its accepted result returned the approval identity, candidate fingerprint,
   actual guidance hash and workflow source through the exact linked request.
4. The same Gym Task received that saved result. Both Tasks retained generation
   1. The result explicitly says `source-observation-only`; **zero model
   executions** ran, so this is transport/source evidence, not behavior proof.
5. Gym's production verifier still rejected convergence against its source-only
   checkpoint. The fixture preserved that rejection and waited for owner
   judgment; it did not rewrite the checkpoint to manufacture completion.

The final linked trial and unchanged no-Gym preflight both pass. The **108-test
Gym suite**, Gym typecheck/syntax build and explicit PoC TypeScript check pass.
The focused test now exercises successful publication and a simulated outage,
including exact approval replay and preservation of a newer source edit.
Earlier tests used an event collector that did not enforce the Host's required
key; the daemon exposed that missing contract check. An initial fixture-only
missing `domain` field and a replay test's unnecessary plan reconstruction were
also corrected without model calls.

### The smallest remaining integration

The useful mechanism already exists: keep the approved artifact and the linked
result with the original Task. The owner judges whether the actual relevant
execution proves adoption; then Gym records that accepted disposition against
the exact checkpoint. A copied file, reload receipt or source-only probe cannot
stand in for that judgment. Keep the operator's activation authority separate
from Gym's candidate approval, and do not close the owning Task merely because
one attempt converged.

That production owner-acceptance mapping is **not implemented** here. The fixture
adapter is not installed, and its imported Gym module is pinned by the App
commit/hash rather than by the Host definition snapshot. The seeded checkpoint
also bypasses benchmark and approval-request emissions: other unkeyed emissions
in `improve-agent` still need boundary verification before claiming an installed
end-to-end loop. No general cross-agent promotion, restart of this linked trial,
compiled-image run, deployment or new GitHub PR is claimed.

## Source-slice verification and known baseline failure

- **107 focused tests pass**, covering both App input routes, projection and
  the candidate approval/replay path. These are not separate from the suites below.
- **Gym full suite: 107 pass, no failures.**
- **Evaluation full suite: 104 pass, 3 fail.** The same three heartbeat Condition
  tests fail on unchanged workspace main: the baseline file run has 6 pass and
  3 fail. They are not changed by this slice and are not counted as passes.
- Both App type checks and syntax builds pass. The PoC has a separate explicit
  TypeScript check, and its no-model preflight passes.
- Source checks cover exact approval, source-only attention, rejection of
  premature completion, non-reapplication after a newer source edit, no reload
  event, reference location, freshness, clearing, replay and safe identity keys.

The source candidate is not advertised as having a green full Evaluation suite.
Resolve or separately disposition those existing heartbeat expectations before
using an all-green suite as a merge/adoption claim. No baseline failure was
silenced or removed to make this change pass.

## Source and next boundary

Local branch: `fix/learning-feedback-adoption-20260912`, based on workspace
`60d6ab989d`. The four feedback checks used candidate `0588a7ba1a` and Host PoC
source `886ae455`. Commit `35254b8411` adds documentation, clarifies the harness
comment and adds a completion-verifier assertion; it does not rerun those checks.
The follow-ups use the separate revisions recorded above. The first source slice
reduces production code by about 199 lines; the separate experimental harness is
not shipped runtime code.
This `/app` repository has no GitHub PR workflow; the candidate remains local
for review. Host #159/#160/#161 were not changed by this slice.

Reproduce the bounded experiment from the candidate checkout:

```sh
bunx tsc --noEmit -p scripts/poc/tsconfig.feedback-adoption.json
bun scripts/poc/feedback-adoption.ts --host-poc-root /path/to/host-method-matrix
# Separate model authorization/credentials are required:
bun scripts/poc/feedback-adoption.ts --host-poc-root /path/to/host-method-matrix --live
```

The runtime adoption path now has isolated same-Task evidence, and the linked
trial returns an exact candidate's source observation to its owning Gym Task.
Next implement **owner acceptance of relevant behavior evidence against the
exact pending checkpoint**. That production completion handoff remains
unimplemented. Verify the execution's selected source, retain
the same Task through any wait, and admit completion only from the actual
result. Do not unblock the source-only checkpoint with a model assertion or a
plain change event. The Host details view's old `last-eval.md` prompt label
remains a separate presentation defect; this App change neither injects that
file nor repairs the UI.

Reproduce the ordinary-Task follow-up from the candidate App checkout:

```sh
bunx tsc --noEmit -p scripts/poc/tsconfig.task-adoption.json
bun scripts/poc/task-adoption.ts --host-poc-root /path/to/host-94864da1 --fixture-tools-root /path/to/teaching-dbb39fee --settle-workers
# With separate model authority/credentials, add --live (at most three calls).
# Omit --settle-workers to investigate the immediate-wake timing arm.
# Add --gym-handoff (without --live) for the seeded-checkpoint linked-Gym trial.
```
