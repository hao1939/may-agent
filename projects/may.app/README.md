# May

**Host requirement:** v3.0.0 for the current producer guidance. The App uses
`conversation` for human input, mode-free Tasks and `facts` for result
observations. New `requests`/`requestId` producer output requires Host/SDK source
containing merged PR #285 and is not introduced here. Retained history stays in
the Host; source compatibility is not deployment proof.

## Conversation guidance ownership

May's [agent instructions](agents/may/AGENTS.md#communication) own interpretation,
intent echo, when to ask for clarification, concise updates and review of
returned work. Extend those instructions or an App skill when improving May's
judgment. The Host supplies current Conversation/Task data, tools, result schemas,
validation and delivery; it does not choose May's communication policy.

Preserve accepted requirements when summarizing a request or judging a result.
An explicit reply anchors meaning, and a correction changes the existing ask
within its authority. Background work receives complete App input with required
references. May reviews its evidence and explains the outcome; admission or a
worker's successful finish alone does not fulfill the human's ask. These rules
cooperate with the common [context assembly boundary](../may-agent.app/docs/2a-design/agents.md#model-context-assembly).

## Coding-worktree source

May declares a Git workspace on local branch `main`. The Host treats a remote
named `origin` as that workspace's publication authority, so advertised
`origin/main` is a new Task worktree's base even when local `main` is ahead; an
advertised Task branch may supply its head. The loaded App definition and a deployed
local commit do not change that Git source choice; a retained Task worktree also
keeps its own head and original base across retries.

For this installation, where locally integrated Apps source is intended to be
authoritative, use the ordinary Git configuration convention: keep the backup or
publication remote under a name other than `origin` (for example `backup`) and
leave local `main` as the worktree base. Use `git remote rename origin backup`,
not config deletion: preparation still prefers a leftover
`refs/remotes/origin/main`. Before changing the canonical checkout, require a
clean repository, record its remotes/upstream, search installed scripts and
operator commands for an `origin` dependency, and prove the change in a
disposable clone with the production workspace adapter. Afterward verify that no
`refs/remotes/origin/*` remain and that a fresh Task fixture starts at local
`main`; existing local Task work stays retained, but backup-only published Task
branches are no longer restored automatically. Roll back with
`git remote rename backup origin` and repeat the remote-authority fixture.

Do not choose the newer commit automatically or infer that installed definitions
and source worktrees share an authority. Publishing local `main` remains the
alternative when the remote is intentionally canonical; it is a separate
operator decision.

People talk to **May** (`app:may`). One logical Conversation Task lineage
handles that interaction: normally one stable execution Task, with a
deterministic linked successor only if the prior execution identity was
explicitly cancelled and fresh human input continues the same Conversation.
Cancelled history is never resurrected, and background feedback cannot create a
successor by itself. May understands the human's intention, discusses it, and
performs authorized work through that lineage. When work needs to continue in
the background, May can assign another Task and keep the discussion available.
Both use the same controller, attempts, outcomes and recovery.

```text
human input -> Task A -> answer or delegate Task B
human input -> Task A -> continue discussion while B runs
               Task B -> accepted outcome -> input to A -> useful reply
```

May may own both Tasks. Another App is useful when it owns the domain,
requires specific authority, or provides expertise or a workflow. The selected
agent or workflow runs one bounded attempt; it does not own a second lifecycle.

A **Request** records an accepted ask whose outcome May must return. Admitting
background work does not fulfill it. May judges the returned evidence against
the latest scope, explains the outcome and closes the Request when appropriate.
A Task remains available after accepting an outcome; its assigning App, parent
agent or human decides whether to revise or close the assignment.

Evaluation escalations use the ordinary `message` input. The subscription
validates the message and correlation key, then retains the original event in
`data.context.event`, including its source, target, local key, dedupe key and
available session/report references. This is a request for judgment, not a human
decision or approval. Runtime retains the original delivery identity; the App
does not create another correlation or work lifecycle. New producers can supply
structured message context without adding a new conversational input kind.
Direct App text is mapped to durable May Task work with the original message and
context; acknowledgment alone does not settle it.

Roll out the PR285 companion in compatibility order. The text mapper and metric
reader remain backward-compatible with old-format `state`/`continue` results and
saved `dependencies`, so activate them first while the current producer guidance
continues to emit that v1 format. Read the App definition back before activating
a compatible Host/SDK containing merged PR #285, because the mapper must be
present before the Host routes App text requests to May Tasks. Only after that
Host/SDK is active may producer guidance move to current `requests` and
`{requestId}` Conditions; the old SDK rejects that output. This source change
does not make that guidance migration or prove activation.

The staged source adds bounded independent Evaluation operation oversight through
May's existing metric collection, alert episode and `metric-response` path. The
six-hour metric groups retained terminal attempts by exact Evaluation Task and
generation; it also reads unresolved pre-attempt Evaluation `input-admission`
recovery counters directly from durable inbox state. This makes a retained input
with repeated mapping/admission failures discoverable after definition install or
process restart, even though it never produced a Task attempt and Evaluation's
semantic path correctly excludes Evaluation-owned subjects. Three failed/rejected,
accepted-incomplete or stale/requeued interruptions—or three retries on one such
admission boundary—open one alert episode. Ordinary identity includes
`runtime/compat/owner-review`; user cancellation is excluded. Each sample states
its mixed denominator, time cut and retained-history/example limits.
May handles only the episode-opening breach, binds its disposition and linked
work to that `alertId`, and reuses a fitting investigation. Repeat samples in the
same episode update durable evidence without another May review. It does not add
a direct first-failure/`handler.failed` subscription, registry, monitor,
Conversation/model call, repair or human message for each failure. Recovery
closes the operational episode but does not fulfill the input, settle its caller
return or erase its requirements. This is a trial App attention policy, not a
retry cap, proof of waste, semantic Evaluation self-review, or the deferred
generic supervisor fallback.

This paragraph describes the candidate in this checkout. It is not installed
behavior until the compatible May definition is separately reviewed, activated
and read back. The currently loaded definition may still differ; source checks
and a commit do not prove activation. In particular, correcting interpretation
of an old workflow-reference string makes that retained input admissible; it does
not semantically deduplicate a separately submitted replacement. Before rollout,
the owner must compare the original and replacement, follow the supported exact
disposition available for each, and prove consequential work is not repeated.
A newly pending Task is admission evidence, not safe settlement or fulfillment.

Messages retain the discussion. Topics group related messages and reference
exact Tasks. Neither owns execution or copies Task state. Later human feedback
and linked Task outcomes enter the same input loop. A worker's failure report
preserves the assignment and evidence; the runtime paces another attempt with
backoff rather than requiring a separate recovery agent.

Task hierarchy alone does not deliver results. Typed dependencies retain the
exact input/return link; Conditions identify external facts. An `incomplete`
result reports a failed attempt, not owner closure. A waiting Task may return
useful caller feedback with `report: true` while retaining its exact wait.

Ordinary human assignments and corrections use the Conversation creator path,
which preserves the accepted Request and its accountable return route. Trusted,
direct App-owned input is not a shortcut around that path: it requires the
actual App owner to apply its own intent revision and must not strand correction
responsibility.

May's trusted, non-delegated `goal` ingress can deliberately revise an existing
May-owned Task by including `data.revision: { taskId, expectedGeneration }`
alongside the complete corrected `outcome` and `acceptance` (and any applicable
constraints). The App mapper selects that exact Task; common admission then
checks the creator and observed generation atomically before preserving the
Task identity and independent obligations. An outer `targetTaskId` only attaches
input and does not request revision. This route does not grant a Task worker
App-only authority: Task-bound creators continue to use generation-fenced
`tasks.update`. On stale feedback, reread the current Task and submit a new
intentional request; do not retry until success or create a duplicate goal. The
shared authority and reconciliation rules are owned by the
[Task resource engine](../may-agent.app/docs/2a-design/task-resource-engine.md).
This input requires the paired Host/SDK support from PR210: deploy and read back
the compatible Host and SDK before activating the May definition. An older Host
ignores `attachment.expectedGeneration`, so activating the App half first is
unsafe.

The same rule applies to automated research checks: compare the result with
the latest relevant Conversation report. Another run, timestamp or source
fingerprint is not by itself a useful update. Keep unchanged, already-covered
findings in Task evidence; new findings, changed blockers, accepted Request
dispositions and explicit human questions still deserve an answer. This is agent judgment, not a new event filter or reporting ledger.

Keep new progress separate from old asks. A maintained Task can produce useful
findings after the linked Request is fulfilled. Report those findings on their
own merits; old retry messages do not establish why a later cycle ran. Name a
retry or human-requested run only when current evidence supports that link.

The optional 15-minute review schedule discovers linked changes whose
notifications were missed. It uses the same input path and adds no supervision
Task. An unchanged wait or already reported outcome needs no repeated human
update. Later useful findings can be reported without reopening a fulfilled ask.

The four-hour `task-hygiene-review` schedule targets the existing May hygiene
Task directly. It replaces that Task's timer only as its wake method: the Task's
identity, goal, acceptance, constraints and other waits remain unchanged. The
obsolete timed wait is retired only after this schedule is active and verified.
Hygiene may close completed work only through the installed guarded
close-after-result control, using the exact accepted attempt and current Task
fences after checking the full current obligations. A failed or unavailable
guarded close preserves the Task for later review; it never falls back to raw
cancellation merely to reduce counts. Intentional withdrawal remains a separate,
explicitly authorized decision, including when it stops active work.

The [shared-loop design](../may-agent.app/docs/archive/reviews/conversation-input-unification.md)
owns the lifecycle and its evidence. Host deployment and runtime operations
remain with the Host Operations App (`app:may-agent`).

Qualified Scout research and targeted research questions can explicitly select
Bob through the ordinary May goal assignment. Standing discovery keeps one fixed
Task specification and reads changing leads from retained reconciliation facts;
targeted asks keep their own requirements and Host caller/dependency return.
Scout's digest remains presentation-only. Bob may prepare one bounded option,
but May's take judgment is not application authority: an exact worthwhile
candidate still requires final human approval. See the
[research-adoption design](design/research-adoption.md).

Observed execution failures use the same owner judgment and later improvement
stages as Evaluation findings without pretending they have the same evidence
source. Normal recovery remains in the original Task; a new error does not
create repair work automatically. May reads exact Task/execution evidence,
checks linked accepted work, and commissions an independent repair only when its
value justifies the cost. Candidate preparation, human approval, live adoption,
and a fresh check of the original symptom remain separate. See the
[improvement loop](design/evaluation-improvement-loop.md) and the scoped
[failure follow-up decision and trial record](design/failure-follow-up-proposal-20260919.md).

An opt-in [development workflow PoC](docs/development-workflow.md) explores
code-driven implementation and review with Bob (GPT-6) and tech-lead (GPT-5.6).
Its source, model-registry and workspace prerequisites require validation
before activation; it is not a claim that the live App runs this workflow.

The [intent and daily-learning design](docs/intent-and-daily-learning.md)
uses the same Conversation and Task contracts for automatic research-link
handling, corrections, and scoped explicit preferences. Its original
[isolated PoC](poc/intent-learning/README.md) exercises real Host admission and
model judgment with synthetic sources. It does not change the live May agent,
Scout library, preferences, or Gym policy.

The current source-assessment iteration makes May’s inferred outcome visible and
uses Scout’s code-owned source reader and archive procedure. See the linked
design for the boundary between deployed research handling and proposed learning.
