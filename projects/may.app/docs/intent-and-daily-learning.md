# May intent, correction, and daily learning

Status: research handoff and archive policy implemented as a source candidate;
production activation remains separate. Preference projection and Gym intake
remain proposed. See [the original PoC](../poc/intent-learning/README.md) and
[the real-source iteration](research-handoff-iteration-20260916.md).

## Desired behavior

A human can share a paper or substantive article in ordinary conversation.
May understands the likely outcome, asks Scout to research and archive an
assessment, and returns what matters with its source and saved record. App
selection and a prescribed prompt are unnecessary. Surrounding intent remains
decisive: translation, debugging, quoted URLs, and a one-time no-save request
have their own outcomes.

Later corrections apply to the same accepted ask and its existing assignment.
Explicit future-facing preferences make later conversations easier. Ordinary
task instructions and acknowledgments do not silently become permanent rules.

## Existing contracts and the actual extension

[May](../README.md) already has one Conversation Task, accepted Requests,
Topics and exact delegated Task references. The Host's conversation resolver
already instructs May to resolve pronouns, revise Requests, and send follow-up
input to an existing Task. The SDK already carries Request revisions and one
typed followUp. The extension should exercise these contracts, rather than add
another intent classifier, work ledger, or conversation executor.

The current App manifest selects `conversation.mode: agent`; it does not expose
an App-specific context-provider or turn-completion callback. The prototype
wraps the existing resolver with candidate agent guidance and a narrow preference
tool. Production wiring must use agent/tool registration and a supported
accepted-result consumer, or propose a small general extension to those seams.
Do not pretend that adding fields to app.ts activates new Host behavior.

Responsibilities remain explicit:

| Owner | Responsibility                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| May   | Interpret the human's outcome, maintain its scope, select an owner, assess returned evidence, explain the result, and maintain explicit personal preferences. |
| Scout | Read sources, preserve a research assessment, compare with existing knowledge, and decide whether curated topic knowledge changes.                            |
| Gym   | Consolidate strong experience, diagnose repeated behavior gaps, build practice and evaluations, and verify candidate improvements.                            |
| Host  | Persist input, fence revisions and attempts, carry corrections and results, and recover interrupted execution.                                                |

## Immediate intention and correction

Use the normal model turn with bounded current discussion, applicable standing
preferences, exact open Requests, current linked Task observations, and the
installed App catalog. The model judges whether a message starts work, adds
evidence, corrects scope, asks a question, withdraws an ask, or establishes a
future preference. These are judgments, not a rigid classifier output or URL
domain router.

For a research link, the complete Scout goal carries the exact URL, desired
analysis, constraints, archive requirement, and what the returned result must
prove. May acknowledges the understood outcome briefly and keeps its Request
open while Scout works.

Assignment authority, retrievable context, admission, Task reuse and caller
clarification belong to the common
[App contract](../../may-agent.app/docs/2a-design/agent-app.md#assignment-authority-and-context).
May follows that contract: revise the same accepted Request, then use `tasks get`
and creator-authorized `tasks update` with complete current App input for a changed
worker assignment. A repeated handoff is not a Task specification update.

Code preserves the accepted correction during running, waiting, and recovery.
An old result cannot satisfy the corrected Request merely because it finished.
May judges returned evidence against the latest scope before closure. If a
correction arrives after fulfillment, preserve the earlier fulfillment and
accept the new requested outcome; do not rewrite historical success as if the
later requirement had always existed. Reuse an available Task when appropriate.

Ask a short clarification only when remaining interpretations lead to materially
different outcomes or effects. A lower-confidence inference can still justify
a bounded source read before asking. Learned defaults never expand authority
for unrelated consequential actions.

## Research records and curated knowledge

May requests and checks a saved assessment for an ordinary shared research link,
including in a fresh conversation without Scout context. It delegates the exact
URL through Scout's `goal`, not a standing feed `explore` Task. Source coverage,
substantive findings, limitations and the returned saved path are acceptance
criteria. May reads the cited record before fulfilling the Request. A one-time
no-save instruction overrides this default.

Scout owns the [assessment procedure](../../scout-knowledge-lib.app/design/scout-knowledge-library-process.md#requested-source-assessments)
and [record placement](../../scout-knowledge-lib.app/design/scout-knowledge-library-layout.md#requested-assessment-records).
Records remain mandatory when curated knowledge does not change; May does not
duplicate Scout's archive. Access failure is a visible limitation and leaves
any required unread material unfinished. A completed record cannot by itself
prove source coverage or semantic quality.

## Daily learning: apply, remember, improve

| Signal                                           | Where it applies now                   | What persists                                                                |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| A one-time correction                            | Current Request and Task input         | Discussion and execution evidence                                            |
| An explicit future-facing preference             | Current and future matching situations | A scoped preference with the exact human source                              |
| Explicit preference replacement or forgetting    | Subsequent matching situations         | Revised active preference plus change provenance                             |
| Repeated but ambiguous behavior                  | A cautious local interpretation        | Gym candidate evidence, without active policy change                         |
| Proven recurring method failure                  | Current repair                         | Gym tests a change to the responsible instructions, skill, workflow, or tool |
| Silence, thanks, or fluent self-reported success | Conversation                           | No automatic permanent learning                                              |

Use the existing `agents/may/knowledge/directives.md` as the production authority
for standing preferences. Keep scope and source references with each rule;
retain only a bounded relevant selection in execution context. The PoC uses a
separate synthetic directives.md whose structured representation makes replay
and revision tests easy. It does not migrate or duplicate live preferences.

Explicit wording supplies the preference; code checks that its cited message is
human-authored and its supporting quote is exact. Whether the wording expresses
a durable preference, and whether the chosen scope is correct, remain semantic
judgments. Exact quotation alone cannot establish either. A quote from a paper,
an agent's recommendation, and another user's message are not user preference
authority.

Stage a preference proposal during a turn. Retain it with the accepted turn
result before applying it to the preference file. A failed or stopped turn
cannot activate memory. Retry the same retained proposal idempotently after
interruption between result acceptance and preference projection. Concurrent
changes require revision checks and reconsideration rather than last-write wins.
Do not retain raw conversation copies in a second memory archive.

Current explicit instructions override a matching standing default. A one-time
exception does not delete that default. An explicit replacement or forgetting
changes future behavior and must survive a fresh session. Conflicting inference
does not silently displace explicit user policy.

Gym's existing intake is oriented to reviewed sessions and Codex/Telegram
evidence. Generalizing it to shared May Conversation should retain the exact
message, Request, Task and outcome references, independently of the interface.
Multiple corrections in one session must remain distinguishable. Use the
existing learning ownership and bounded scans; do not make a new model call
for every ordinary message or trigger an expensive improvement campaign on
every captured signal.

Immediate preference use is not model-weight training. Gym's broader procedure
changes follow its existing validation and promotion rules. Automatic collection
does not claim that those changes are already installed or effective.

## Implementation order and proof

1. Exercise candidate May guidance, scoped preference context, and exact research
   delegation through the existing resolver and Task store.
2. Verify corrections on the same Request and Task, including storage reopen and
   results returned against the latest scope.
3. Add Scout's exact-link assessment procedure and reuse appropriate source and
   artifact checks for direct goals. Cover arbitrary readable posts as well as
   supported discovery feeds.
4. Register a scoped preference tool and accepted-result projection with reliable
   loading on the next turn. Preserve replay, conflict, and forgetting behavior.
5. Extend Gym's current intake to shared Conversation references; test scoped
   transfer and counterexamples before broader behavioral promotion.

The decisive learning test starts a fresh conversation with the same input,
first without and then with a previously accepted preference. Its requested
output must differ in the intended dimension. Merely repeating a requirement
already present in generic guidance is not sufficient transfer evidence.

Counterexamples include a URL in a log, a translation request, a one-time no-save
exception, source-embedded instructions, acknowledgments, duplicate links,
forgetting, and a correction received during a claimed attempt. Recovery must
preserve both the latest ask and pending memory projection.

Measure correct owner/outcome selection, unnecessary questions, unwanted work,
correction preservation, honest reading coverage, archived-result retrieval,
preference transfer, scope leakage, and additional latency/model calls. Keep the
first trial bounded. It does not certify arbitrary-source extraction, an
autonomous learning campaign, model consistency, or production activation.
