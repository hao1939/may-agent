# Keep domain policy in Apps, keep the Host generic

**Status:** Accepted; documentation and the first source slice are applied for
review. The broader cleanup is not complete. Deployment and live
permission/state changes remain separate and are not authorized here.
**Reviewed:** September 12, 2026, against fetched Host `main`
`649d801c134ec321c9e43dfca21aaa7392ae9e41` and the current workspace design documents.
This is source evidence, not a claim about the running installation.

## Proposal in plain language

May's maintenance is a domain, just like research or software testing. The App
that understands that domain should own its knowledge, procedures and decisions.
The Host should not need to know that an agent is called `tech-lead`, that an
improvement process uses Gym, or that a particular App is called Host Operations.

Keep the existing Host/App split. Remove special treatment and duplicate paths
that contradict it; do not introduce another framework to enforce the vocabulary.

The intended outcome is a system that is easier to understand and extend:
adding or replacing a domain App should normally change that App and its
installation wiring, not generic execution or recovery rules.

This proposal follows [Core Principles](../1-principles/core-principles.md) and
the [Host/App boundary](../2a-design/system-boundary.md). It is a focused companion
to [authority-boundary simplification](authority-boundary-simplification.md),
not a competing Task-runtime cleanup plan.

## The responsibility split

| Responsibility | Home |
| --- | --- |
| Understand a domain, choose useful work, judge results and decide what to do about failures | The responsible App and its agents, knowledge, tools and workflows |
| Persist admitted work, run bounded attempts, enforce controls, recover and return evidence | The Host |
| Collect provider facts, execute a supported operation or present results | A suitable adapter or tool using existing contracts |
| Select installed Apps, bind deployment access and grant operational scope | Trusted installation configuration and deployment tooling |

These are responsibilities, not four services. Adapters can remain in the Host
repository and process. No new configuration framework is proposed.

The distinction is not simply **code versus agent**. App policy can be code:
"wake tech-lead for this metric" is still domain policy even if it is deterministic.
"reject a result from an obsolete attempt" is a generic Host rule.

May may still investigate, edit, verify and answer directly within the human's
authorization. This does not require a handoff to a maintenance App for every
technical question. Independent work uses the existing Task mechanism; an App
boundary matters when responsibility, expertise or operational authority differs.

## What the review found

| Area | Source evidence | Why it matters |
| --- | --- | --- |
| Host Operations | [App declaration](../../app.ts), [deployment owner check](../../../may-agent/scripts/deploy-receipt.ts), [deployment prompt](../../../may-agent/src/app/adapters/executors/agent-workspace.ts) | An ordinary domain App is also described as a special system authority; generic execution knows its deployment procedure. |
| Named-agent privileges | [Cross-edit guard](../../../may-agent/src/lib/tools/cross-edit-guard.ts) | `may`, `tech-lead` and `evaluator` receive name-based exceptions. Changing an agent name can change write treatment. |
| Deputy tool policy | [Policy names](../../../may-agent/src/lib/session-policy.ts), [tool filtering](../../../may-agent/src/lib/agent-execution.ts) | A human-facing role is also a tool restriction preset. Current Conversation execution uses `app-agent-full`; retained deputy names are not proof that current May is restricted to handoffs. |
| Escalation | [Daemon subscription](../../../may-agent/src/app/daemon-events.ts), [legacy lifecycle](../../../may-agent/src/lib/escalation-lifecycle.ts), [current design](../2a-design/escalation.md) | The docs call old records read-only, but a registered listener still handles resolution and can request a source-session resume or owner review. Actual live usage is not established. |
| Maintenance and metrics | [Private maintenance adapter](../../../may-agent/src/app/adapters/maintenance/README.md), [tech-lead jobs](../../agents/tech-lead/cron.json), [metric catalog](../../agents/tech-lead/handlers/metrics-snapshot.ts) | Runtime recovery, domain reviews, digests and metric policy share a private maintenance path. Merely living in an App folder has not made all of them ordinary App capabilities. |
| Learning and Gym | [Coach-specific status](../../../may-agent/src/lib/tools/system-dashboard.ts), [learning design](../2a-design/practice-learning-loop.md) | A particular improvement arrangement appears in generic reporting and whole-system descriptions. Useful mechanisms should not require these particular Apps or agent names. |
| Project owner and control plane | [Projects contract](../2a-design/projects.md), [legacy command route](../../../may-agent/src/app/command-router.ts) | Docs say historical Markdown is not a runtime path, but the command route still updates legacy project discussion/status and falls back to `tech-lead`. |
| Task and Conversation descriptions | [System Model](../2a-design/system-model.md), [Message Lifecycle](../2a-design/message-lifecycle.md), [Architecture](../2a-design/architecture.md) | Some status paragraphs still say shared execution is unimplemented, while Architecture records the #158 merge. Old mode names and new lifetime semantics need separate, accurate descriptions. |

The table distinguishes observed code from unverified use. A registered path
is not proof that it currently receives traffic. Before removing one, inspect
its callers, configured consumers and retained obligations.

## Proposed changes

### 1. Make maintenance an ordinary App responsibility

Remove **Host Operations** as a core architectural concept. In App-specific
documentation, describe `may-agent` as "the App that maintains May." Keep the
technical App ID and existing Task identities; a naming cleanup needs no data migration.

Keep source knowledge, investigation, deployment judgment and acceptance in
that App. Move deployment-specific agent instructions out of the generic
executor. Return operation evidence through the existing Task/event/evidence
contracts rather than teaching every executor a deployment receipt convention.

Keep atomic activation, exact artifact checks, duplicate-effect protection,
failure receipts and rollback in the deployment tooling. Those safeguards do
not become optional because the decision belongs to an App.

The current rule naming `may-agent` as deployment owner should become an
explicit installation policy, not a universal Host contract. The exact narrow
binding needs an implementation review. Until it exists and is tested, retain
the current restriction; do not replace it with an agent-supplied App ID or
permission flag. A different agent name alone must not grant deployment access.

### 2. Separate agent identity from granted capabilities

The Host should enforce an operation's granted scope without inventing trusted
roles from names such as `may`, `tech-lead` or `evaluator`. App guidance may say
who normally performs a review; trusted tool construction or installation
policy determines what that execution may change.

Use the smallest existing tool/configuration seam that can carry the required
scope. Do not build a general role, identity or permissions service for this
cleanup. An agent's own editable instructions must not grant broader access.

Preserve protections for shared guidance, other agents' configuration and
evaluation truth. Existing file-tool guards are not a complete filesystem
sandbox; do not claim that changing them secures shell or native-agent execution.
State and test the actual enforcement boundary.

Keep "deputy" as an optional description of May's relationship with the human,
not a required execution mode. Check current tool-policy callers and retained
session metadata before retiring old presets. Existing sessions must never
gain tools merely because an old policy name was removed. Prefer ordinary
declared tools and the necessary execution restrictions over another preset family.

### 3. Return problems through the existing caller path

Use the merged [caller-feedback design](caller-feedback-and-waiting.md): do safe
local work, return evidence and any needed decision to the exact caller, and
keep the assignment open until its owner closes it.

"Escalation" can remain ordinary language for asking someone with different
authority to decide or act. It is not a new resource, mandatory cross-App
handoff or automatic response to a failed attempt. Different authority can
exist within one App; a normal cross-App dependency is not necessarily escalation.

Retire the old resolution-to-session-resume path only after mapping its live
consumers and any unfinished obligations. Replace needed behavior with existing
Task returns, dependencies or Conditions, not another escalation event pair.
Keep historical events and trace reads. If an unresolved legacy case cannot
be safely correlated, expose that limitation for an owner decision rather
than guessing a replacement Task or silently dropping it.

Update the canonical escalation document to distinguish the merged caller
contract from retained compatibility behavior. Do not implement #169 again.

### 4. Split mechanical upkeep from domain observation and review

Keep deterministic recovery of Host-owned claims, processes and resources
with the Host. Required recovery must not depend on installing a maintenance
agent, enabling its optional schedule or choosing a particular agent name.

Classify each existing private maintenance job by what it does, not by its
filename or whether it calls a model:

- generic recovery stays with the Host;
- domain observations use ordinary App observers or declared metric sources;
- review and digest policy uses the owning App's existing schedules and Tasks;
- unused compatibility callbacks are removed after the caller check.

Move domain metric definitions to the Apps that understand them. Generic
execution measurements can remain in an optional reporting component; they
need not become a new metrics App or a mandatory core service. Decouple that
component's activation from a `tech-lead` job where the coupling is confirmed.
The sampler also recognizes particular domain script filenames for batching;
move such optimizations to their producer or remove them if they do not earn
their cost, rather than expanding a Host list of special script names.

Preserve workflow/attempt error evidence even with reporting disabled. Missing
or stale measurements must remain visible as unknown, not zero or healthy.
This proposal does not replace metric storage or introduce another scheduler.

### 5. Describe learning as a capability, not a required organization

Keep generic mechanisms for reading evidence, editing authorized guidance,
running isolated checks, activating reviewed source and observing later results.
Agents can combine these mechanisms in an ordinary Task without a new learning
controller or a human operating every intermediate step.

Evaluation criteria, coaching methods, benchmark truth, improvement selection
and promotion rules belong to their owning Apps. Move hardcoded Coach reporting
there, or remove it if it has no useful consumer. Document the Evaluation/Gym
arrangement as one integration, not the universal May improvement lifecycle.

Keep useful evaluation summaries and historical evidence. Do not remove Gym
adapters while Gym still imports them, move App state into a new database, or
weaken exact-artifact approval/protected-test rules as a side effect of naming
cleanup. Reuse the existing [extension proposal](agent-behavior-and-capability-extension.md)
and [scripts retirement boundary](poc-retirement-and-knowledge-20260912.md).

### 6. Give each description one clear meaning

Use the existing terms consistently:

- **Host:** generic execution and state machinery; "runtime" describes that
  machinery, not another owner.
- **App:** responsibility and policy, implemented with code and agent guidance.
- **Project:** goal/context and workspace; not another execution controller.
- **Agent:** an execution profile, not an implicit administrator.
- **Task:** the durable execution identity; an accepted result does not itself
  mean its owner closed the Task.
- **Attempt:** one bounded execution. A conversational Turn is an attempt in
  its human-facing context.
- **Request:** an accepted ask owed an outcome; distinguish it from a merely
  admitted input or transport receipt.
- **Condition:** the exact fact or decision being waited for.
- **Observer:** collects facts; the responsible App decides what they mean.

Keep Event, workflow and evidence terminology where it explains real mechanics.
Do not flatten failure, waiting, cancellation and successful completion into
one "done" state. Do not mass-rename persisted fields or public SDK names.

Replace `.app control plane` with "App definition and policy" where a directory
is meant. Describe optional components as "outside core" when location matters;
they do not need separate processes. Say `supervisord` or "container process
manager" when that actual program is meant, not "supervisor" as an agent role.

Retire legacy Markdown project dispatch separately from read-only project
history. Missing routing should be reported explicitly, not default to
tech-lead or May. Diagnostic attribution must not silently become work assignment.

## Documentation changes after acceptance

Keep the existing documentation home; this proposal does not move the entire
design tree just because it is stored beside the maintenance App.

- System Model owns the concise vocabulary; Architecture owns the component map.
- System Boundary owns the generic responsibility rule, without a required named App.
- The maintenance App README and operations guidance own its installation-specific procedure.
- Scheduling, metrics, escalation and learning documents explain their generic
  contracts and link to concrete App integrations instead of prescribing them.
- Mark source gaps, pending changes and historical descriptions explicitly.
  Correct stale "not implemented" paragraphs against the reviewed revision.
- Keep dated evidence in the existing archive and implementation status with
  its owning proposal. Do not copy another PR-status inventory into every design page.

The existing Task/HTTP work described in the
[authority proposal](authority-boundary-simplification.md)
already covers some vocabulary and evaluation boundaries. Refresh its actual
merge state before implementation; contribute there rather than starting a
competing rewrite.

## Delivery order and verification

Use independently reviewable changes, not one large cleanup PR.

| Step | Change | Required evidence |
| --- | --- | --- |
| 1 | Align current descriptions and document the policy placement | Links resolve; source-status claims match a named revision; examples still satisfy the real SDK. No behavior or permissions change. |
| 2 | Remove named-role and deployment-policy coupling in separate focused slices | Granted actions still work; ungranted writes/deployments stay rejected; missing configuration cannot broaden access; deployment evidence and duplicate-effect protection survive interruption. |
| 3 | Retire legacy escalation/project action paths | Consumer inventory; exact caller delivery; no duplicate resume or lost unfinished obligation; historical reads still work. |
| 4 | Separate private maintenance, domain metrics and optional learning presentation | Relevant App works through ordinary contracts; removing it preserves unrelated work and truthful failure evidence; no duplicate jobs or collectors. |

Prefer existing regression suites with temporary Apps and stores. Add a focused
case for each changed boundary; no permanent PoC framework is needed. Refresh
the source baseline and check overlapping work before each slice.

For absence checks, use an isolated installation without the selected App.
If the App owns unfinished work, first drain it or exercise the existing removal
rejection. Optional capability does not authorize abandoning accepted Tasks.

Code and documentation checks establish source behavior only. Production
permission changes, deployment and live verification require their own explicit
authority. Do not restart or alter the current installation to review this draft.

## Application record — September 13, 2026

The first Host slice is [PR #176](https://github.com/hao1939/may-agent/pull/176),
source `d651f3f492c9e57ca669caa83d267690d9987647`, based on `649d801c`.
It is independent of the open Task-contract work in #168. No production
activation, model call, permission change or state migration was performed.

### Applied in this slice

- Current principles, boundary, work model, App descriptions and operations
  guidance distinguish ordinary maintenance policy from Host mechanics and
  installation authority. Stable App/Task IDs and existing deployment checks
  are unchanged; May may still work directly for the human.
- Scheduling, learning and lifecycle documents distinguish liveness from App
  review, optional Evaluation/Gym integration from generic capabilities, and
  merged shared execution from remaining SDK cleanup. The old escalation
  listener is honestly documented as active, not read-only.
- The command router no longer appends legacy discussion Markdown, activates
  project posture, selects a fallback owner or emits `project.nudge`.
  Historical reads and recorded events remain intact.
- HTTP no longer converts a missing App or unavailable admission into a
  fallback comment receipt. The browser shows failure and retains the input;
  it no longer promises automatic project resumption.

The consumer check changed one implementation decision: the maintenance App
and Gym deliberately accept comments through declared subscriptions, not
generic `message` inputs. Their subscription route is **not** the retired
Markdown handler. It remains available after a definitive message-schema
rejection. Evaluation and Scout also declare comment subscriptions. A
record-only fact is still not a completion or work-acceptance claim.

Verification at that source revision:

- Three focused router regressions first reproduced legacy Markdown/status
  mutation. They now cover shared and agent-local history, with and without
  a declared durable consumer, retaining the original event and no nudge.
- The socket test now exercises a real App subscription, Task and accepted
  isolated-workflow result. Browser coverage exercises missing-App rejection,
  retained text/history, declared App handling, same-key receipt reuse and
  the existing shipped chat renderer. The old filesystem integration assertion
  is consolidated into the focused regressions, not preserved as a second policy.
- Host `bun run ci`: **2,921 passed, three installation-only skips, zero
  failures**, including real socket/daemon and Chrome tests. The first full
  run exposed three legacy expectations; the supported-path tests replaced
  them. There were no automatic retries or new skips.
- Companion `bun run check:may-design`: passed; `bun test
  ./projects/may-agent.app/app.test.ts`: **13 passed**. These check the local
  documentation/App tree; they do not certify a deployed installation.
- Hosted checks and independent review are recorded on #176, separately
  from local validation. Do not infer merge or deployment from this record.

### Still open, deliberately not weakened

| Boundary | Remaining work and reason |
| --- | --- |
| Named file-tool permissions | `cross-edit-guard.ts` still contains name-based grants. The existing tool factory has no trusted scope input; the workflow guard loader is fail-open and is not a permissions replacement. Design the narrow trusted binding before removing exceptions. These guards are not a shell/filesystem sandbox. |
| Deployment | The exact open `may-agent` Task requirement and executor receipt prompt remain. An App-owned replacement must preserve receipt discovery, exact artifact/Task correlation, interrupted-operation evidence and activation protection before removing this coupling. |
| Legacy escalation | Daemon error recovery still emits legacy events, the lifecycle subscriber still resumes correlated sessions, and the maintenance App still configures a consumer. Map unfinished installed obligations read-only before retiring this path; never guess their new owner. |
| Maintenance and metric policy | Private jobs still mix mechanical recovery, review/digest policy and the metric catalog. The sampler's two filename-specific batching rules remain; removing them blindly could multiply producer work. Move the producer contract and verify cadence/failure evidence together, without a new scheduler. |
| Optional learning presentation | The generic status dashboard still counts a named Coach's `growth-cycle` sessions. Remove or replace that presentation with App-owned reporting while preserving generic evaluation/session reads. Existing Gym imports remain supported. |

These are source gaps, not completed work or new architectural components.
The next slice should select one narrow boundary and its consumer/regression
evidence. Do not bundle a permission redesign and a live escalation cutover
into the verified project-comment change.

## What makes this worthwhile

The benefit is fewer hidden exceptions, duplicate action paths and choices a
human or agent must remember. The cost is reviewing existing consumers and
moving policy without losing safeguards. Extra indirection or a configurable
replacement for every old conditional would defeat the purpose.

We are done when the selected boundaries have one clear owner, ordinary Apps
can use them without privileged names, and removing an optional App leaves
unrelated work correct. We do not need zero historical terms or zero domain
examples in the repository. If a relocation adds machinery without removing a
real coupling, leave it out or narrow the feature instead.

## Decisions requested from reviewers

1. Is the proposed Host/App/installation responsibility split clear and sufficient?
2. Do we agree to remove Host Operations as a core concept while retaining the
   existing maintenance App and its stable technical identity?
3. Are there necessary callers or obligations that prevent retiring the named
   legacy paths? Identify the exact consumer, not only a historical feature name.
4. Does the proposed sequence preserve useful safeguards without introducing
   another permissions, escalation, maintenance or learning framework?
