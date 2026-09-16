# May intent, correction, and daily learning

Status: proposed; isolated PoC only. No production behavior or preferences have
been changed. See [the trial](../poc/intent-learning/README.md) for reproduction
and the evidence boundary.

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

A correction has two distinct durable effects:

1. Revise the same Request using its observed revision, preserving unchanged
   requirements and its exact Task references.
2. Admit updated input to that same Scout Task through the existing followUp
   route. Include the complete current requirement and correction provenance.

The existing followUp-to-existing-Task path admits new input; it does not itself
rewrite the worker's original Task spec. The worker must consider those inputs
when assessing its current outcome. An authorized spec change, when needed,
uses the creator's existing control. Do not claim that feedback admission is
an immediate interruption or a rewritten spec.

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

Every completed user-requested research assessment has a durable record, even
when it changes no canonical topic note. The record includes source identity,
observation time, what content was available, claims and evidence, uncertainty,
the user's question, relationships to existing knowledge, and disposition.

Use Scout's existing findings layout for those records. Search by source identity
before creating one; revisit the existing record when the source or question
changes, preserving earlier assessment evidence. Normal version history can
retain revisions. The PoC's local history files are fixture evidence, not a new
production library layout.

Source acquisition failure leaves a visible access record and an unfinished
full-reading assignment. An explicitly requested abstract assessment can finish
with honest abstract coverage. The archive cannot prove that unavailable full
text was read. A new canonical knowledge claim is optional and requires Scout's
judgment; the research record is mandatory unless the human makes an exception.

Checks should confirm the source actually read, honest coverage, existing output,
read-back and references. They do not prove semantic quality. Test that separately
with evidence-sensitive cases and human review of substantive conclusions.

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
