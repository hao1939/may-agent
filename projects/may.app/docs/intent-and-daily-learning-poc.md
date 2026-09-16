# Intent and daily-learning trial

Date: 2026-09-16. Status: isolated candidate; production adoption remains separate.

The [design](intent-and-daily-learning.md) was refined into an
[executable trial](../poc/intent-learning/README.md) using real model judgment and
real Host admission/storage with synthetic research sources. The trial does not
change the running May agent or its preferences, Scout library, or Gym behavior.

## Findings that changed the design

The Host already implements conversational intent judgment, accepted Request
revisions, exact Task feedback, and result assessment. The App declaration has
no context-provider/after-turn callback. A proposed custom field in app.ts would
not activate a new behavior. The candidate therefore attaches guidance and a
narrow preference tool to May's existing resolver in the isolated harness.

Feedback to an existing Task is durable new input, not an automatic rewrite of
its original spec or an instantaneous worker interruption. The real-Host test
confirmed that a correction arriving during a claimed attempt leaves the old
result incomplete and preserves the correction for the next attempt.

The first preference scenario requested evidence-first paper assessment, which
overlaps the default research procedure. That alone was weak evidence of learning.
A second test uses a distinct, scoped language preference: the same fresh paper
input is run with the learned preference withheld and available. The assignment
changes to Chinese only when memory is available, while an unrelated HTTP question
stays in English. This is context-based preference transfer, not model training.

The exploratory run also exposed an unnecessary explanation of turn acceptance
in the forgetting reply. The candidate policy now expresses the intended behavior
plainly and keeps persistence mechanics out of the conversation. A final transfer
check verifies that forgetting still works without that explanation.

Duplicate-source archival initially used the current observation date when
choosing a filename. The revised fixture finds an existing record by source
identity across dates and preserves the previous assessment when updating it.
The offline regression crosses a date boundary.

Admission review found that a model could otherwise imitate a staged preference
by putting a serialized proposal into ordinary result facts. The candidate now
reserves that representation for its scoped tool, rejects model-authored copies,
and rechecks the original human message when projecting accepted changes. An
offline rejection test and the final model replay cover the hardened path.

## Verification

The focused suite has **15 passing tests**: seven existing May App contract
checks and eight new memory, archive, and Host integration tests. Host integration
uses immutable source `b19fca526de3b96309d502021bda1984c8d5935c`. Type checking and
format checking passed.

Both final model runs passed, with **20 checks across 18 agent invocations**:

| Run                                                   | Checks | Agent invocations |     Elapsed | Estimated model cost |
| ----------------------------------------------------- | -----: | ----------------: | ----------: | -------------------: |
| Link, correction, archive, memory and exceptions      |     15 |                13 | 180 seconds |               $0.409 |
| Scoped memory transfer, counterfactual and forgetting |      5 |                 5 |  67 seconds |               $0.145 |

The runs used GPT-5.6 Sol and ran concurrently. Costs are registry estimates from
reported usage, not billing receipts; they describe the final runs only. The
checks are scenario assertions, not independent samples or a statistical pass
rate. Exploratory evidence was retained as well.

The model runs and representative decisions are recorded in the
[portable evidence JSON](../poc/intent-learning/evidence.json). Each final run captures hashes of the candidate code,
guidance, and App declarations together with the frozen Host revision. Raw
isolated evidence is retained separately; no production sessions or credentials
are included in the portable record.

The complete May App check is **not green**. Its existing development-workflow
suite has 15 failures, reproduced without this change on main. Most surface
`ctx.signal` being undefined in the existing fixture; one interrupted-edit
assertion also fails. The new PoC checks pass. This unrelated fixture/SDK
compatibility issue needs its own repair before claiming a clean full-App gate.
An initial sparse-checkout missing the Host-owner instruction file was corrected
before the focused verification; it was a test-environment issue.

## Evidence boundary

- The May and Scout model calls are real GPT-5.6 Sol calls. Their documents,
  user messages, source-access limits, and tools are synthetic fixtures.
- The Host really admits Requests and Tasks, preserves revisions and new input,
  rejects stale completion, and reopens its SQLite store. The harness explicitly
  admits the returned Scout result to May; full automatic notification delivery
  and the scheduler are not exercised.
- The running-correction case uses a deliberately held real Host claim and a
  synthetic obsolete result. It tests fencing, not model interruption timing.
- The archive verifies exact-source access, coverage, quotations, and file
  read-back. It does not certify arbitrary-source retrieval, semantic quality
  across papers, or integration with a populated real library.
- A preference is staged, retained in the accepted turn, projected to a fixture
  file, recovered after reopening storage, and read by a fresh model invocation.
  This does not prove process-crash lock recovery or production context loading.
- Repeated implicit patterns remain a Gym proposal in the design. The PoC proves
  explicit preference retention and scoped application; it does not run Gym,
  promote benchmark truth, or certify a deployed self-improvement loop.

## Recommended next implementation

Keep the current May conversation path. Register the scoped preference capability
and a reliable accepted-result consumer through supported extension points;
ensure the next turn receives current preferences. Give Scout the exact-link
assessment procedure with mandatory research-record verification and explicit
reading coverage. Reuse Request revisions and exact Task input for corrections.
Then extend Gym's existing evidence intake to shared Conversation references and
evaluate repeated implicit patterns separately from immediate user preferences.

The bounded trial supports that direction. It does not justify replacing the
conversation controller or introducing another learning scheduler.
