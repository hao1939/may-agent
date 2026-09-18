# May

**Host requirement:** v3.0.0. The App uses `conversation` for human input,
mode-free Tasks and `facts` for result observations. Retained history stays in
the Host; source compatibility is not deployment proof.

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

Messages retain the discussion. Topics group related messages and reference
exact Tasks. Neither owns execution or copies Task state. Later human feedback
and linked Task outcomes enter the same input loop. A worker's failure report
preserves the assignment and evidence; the runtime paces another attempt with
backoff rather than requiring a separate recovery agent.

Task hierarchy alone does not deliver results. Typed dependencies retain the
exact input/return link; Conditions identify external facts. An `incomplete`
result reports a failed attempt, not owner closure. A waiting Task may return
useful caller feedback with `report: true` while retaining its exact wait.

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

The [shared-loop design](../may-agent.app/docs/proposals/conversation-input-unification.md)
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
