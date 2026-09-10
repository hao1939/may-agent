# One fact, one owner: remaining simplification work

**Status:** Active proposal. Direct-work and attempt-context rules are incorporated
in current design and source. Further request-path deletion, a model-behavior
comparison, and the delivery pilot remain unfinished.
**Reviewed:** September 9, 2026, against the [documented source baseline](../README.md).

Keep one owner for each fact and outcome. Use existing Tasks, bounded attempts,
events and reads to remove competing decisions and writers. The next changes
should make an existing path simpler without adding another work lifecycle.

## Current contract

| Question | Owning document |
| --- | --- |
| When can May work directly, and when does it need a Task? | [System Model](../2a-design/system-model.md#a-turn-or-a-task) |
| How do conversation, exact Task links and follow-through work? | [Message Lifecycle](../2a-design/message-lifecycle.md) |
| Who owns domain policy and acceptance? | [Host/App Boundary](../2a-design/system-boundary.md) |
| How do attempts, waits, cancellation and recovery preserve work? | [Task Resource Engine](../2a-design/task-resource-engine.md) |
| Which capabilities can be replaced or removed? | [Stable core proposal](task-runtime-organization.md) |

May may investigate, edit, verify and answer in an authorized bounded turn.
Continuation uses an ordinary Task. The responsible App accepts its own
outcome; May's follow-through retains exact links without taking over that
acceptance. This proposal does not redefine those contracts.

The [review history](../archive/reviews/authority-boundary-history-20260909.md)
preserves the incident analysis, earlier alternatives, source revisions and
scoped authorization record. The [September 6 pilot](../archive/reviews/authority-boundary-pilot-20260906.md)
records the exercised lifecycle, wait and restart cases. Neither establishes
the current deployed release or completion of provider-facing delivery work.

## Remaining work

| Work | Boundary and next proof |
| --- | --- |
| Retire conversational child-request waiting where redundant | A dated audit found retained open obligations. Inventory current callers and retained requests before deletion; keep ordinary caller/result correlation and Task-to-Task dependencies. Drain or migrate real obligations explicitly. |
| Measure the context cleanup's behavioral effect | Compare baseline and candidate on the same small conversation cases. Existing scripted regressions establish supplied context and mechanics, not improved model judgment. |
| Move Evaluation policy out of HTTP | Separate Host/Evaluation change: preserve exact feedback identity, history and the meaning of “saved.” Event admission alone cannot claim feedback was persisted. This remains deferred from the May cleanup. |
| Prove one App-owned delivery workflow | Select one repository, responsible Task, executor and requested terminal outcome. The recorded read-only PR assessment did not exercise publication, review dispatch or validation effects. |
| Assess historical production state before rollout | Verify the actual artifact and retained state. Candidate fixes do not establish that a previously revived Task generation was authorized or repair historical rows automatically. |

These are separate slices, not prerequisites for every ordinary May Task. Keep
the [convergence tracker](design-implementation-convergence.md) for verified open
source gaps and the core proposal for implementation separation. Do not copy
their backlogs here.

## Proposed delivery workflow

Use the repository's existing responsible App. One ordinary workflow collects
current provider facts, chooses eligible work, invokes existing tools or a
bounded agent, and returns a Task result or exact wait. Keep pure eligibility
helpers beside the workflow and provider reads in its existing observer or
adapter. The Host continues to own admission, storage, scheduling and recovery.

```text
provider fact -> declared event route -> responsible Task
  -> App workflow reads current facts and repository policy
  -> eligible tool operation or bounded agent job
  -> verified result, exact wait, or visible blocker on the same Task
```

Use code for an agreed repeatable process, guidance for situational judgment,
and an agent for implementation or focused interpretation. A worker may handle
a useful batch of findings; one accepted supervisory decision is not a limit
of one tool call, file edit or suggestion.

| Current facts | Eligible work under the repository's policy |
| --- | --- |
| Implementation or agreed local checks incomplete | Implement and verify the candidate |
| Reviewable candidate and publication authorized | Find or publish the matching PR, then read back its identity, head and state |
| Required review absent | Request the configured review once and wait for its exact evidence |
| Applicable findings remain | Resolve a useful batch or record an evidence-backed disagreement |
| Required current-candidate validation absent | Dispatch the configured validation once for that candidate/configuration |
| Matching review or validation already running | Return an exact wait; continue independent authorized work if useful |
| Required evidence satisfies policy | Present the requested readiness result or obtain required approval |
| Provider confirms the requested terminal outcome | Let the owning App accept the Task with evidence |

Read current facts on each attempt. Do not persist a parallel sequence of stage
Tasks or copy PR/build status into another workflow store. Unknown or empty
policy is not automatic success. A changed candidate may require renewed proof;
the repository's policy decides which evidence remains applicable.

Before an external effect, recheck Task/attempt authority, provider identity,
candidate and policy. After an interruption, read the provider before repeating
the effect. Reuse provider idempotency and existing Task/operation correlation.
If the outcome remains unknown, expose that ambiguity. There is no transaction
covering SQLite and the provider.

Keep implementation and judgment in the worker job, and publication, dispatch,
approval and merge decisions at the App workflow boundary. This is only an
enforced capability boundary when the worker's actual tools and credentials
enforce it; prose alone does not restrict a full-access shell.

## Sequence and acceptance

1. Recheck current callers and retained obligations for the exact slice. Remove
   a path only after its required behavior has a supported home.
2. Use isolated fixtures to prove admission, duplicate input, exact waits,
   uncertain effects and restart. Reuse the production boundaries in tests.
3. For the delivery slice, exercise one explicitly scoped provider workflow
   through its requested outcome or a precise external blocker. Source review
   and dated pilot permissions do not establish live rollout authority.
4. Delete only duplication demonstrated by that proof. Executor, storage and
   SDK cleanup can follow through the core proposal; no broad rewrite is needed.

A slice is complete when:

- one responsible Task retains its identity and accepted state across attempts,
  duplicate events, interface closure and restart;
- late or replaced attempts cannot accept results or duplicate external effects;
- stopped work stays stopped, while an authorized newer generation remains visible;
- an unchanged blocker stays quiet, retains its recovery review, and resumes on
  the relevant fact without repeated model polling or human notifications;
- source and destination Apps keep their own acceptance authority, and adapters
  report admission separately from completion;
- a removed capability leaves the remaining system correct, with missing
  capability visible on affected work; and
- the delivery trial, if included, proves matching candidate evidence and its
  explicit stopping outcome without another CLI, workflow or supervisor lifecycle.

Report what was exercised and which evidence is synthetic, source-based or
live. For model comparisons, also check answer usefulness, wrong-owner choices,
duplicate Tasks, missed follow-ups, model turns and latency. Shorter prompts or
fewer lines alone do not prove better behavior.

The review should settle which remaining slice comes next and its acceptance
contract. Completed slices move to their owning design and dated archive;
unfinished work must remain explicit. Herdr or a new workflow framework is not
required by this proposal.
