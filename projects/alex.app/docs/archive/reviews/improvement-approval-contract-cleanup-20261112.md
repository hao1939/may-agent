# Improvement approval contract cleanup — 2026-11-12

**Supports:** [Simple first](../../1-principles/core-principles.md#simple-first)
and [exact human decisions](../../2a-design/human-control-surfaces.md#exact-plain-text-decisions).
Use the existing Host approval contract so a valid human decision can authorize
its exact candidate without another parser or approval mechanism.

**Status:** App source fix verified locally against merged Host #454
(`c5c163aafcc16c148c75119d5f9b39dab8c65707`). Apps base:
`a88d29877f`. This record travels with the App change. No Host source change,
deployment, live-state migration or installed activation is established here.

## Defect and smallest correction

The [Task cleanup trial](task-api-cleanup-20261112.md) exposed two separate gaps.
Its old composition fixture acknowledged Conversation input without delivering
the formal approval. After connecting the current durable Conversation route,
an authentic Host approval still failed the App verifier: Host supplies nested
`data.proposal` and `data.hostApproval`, while the App required flat bindings and
the obsolete `data.provenance` that Host deliberately discards.

`trustedDecisionFromEvent` now uses the public SDK's existing
`readVerifiedApprovalDecision`. The App keeps its own policy: authenticated human
reply, exact journal ID, target App/Task, Task generation, Condition, subject,
displayed text and complete expected contract, including packet/proposal hashes,
revision and allowed decisions. The current Task reread also compares that full
contract immediately before source application. Superseded subjects or decisions
cannot pass just because their remaining hash fields match.

This does not widen approval to operator-stamped events. The existing manual
operator fallback is separate. Old flat events remain historical evidence;
there is no legacy acceptance adapter. Candidate, evidence, activation-scope,
source cleanliness and idempotent-replay guards remain in their existing owners.
See the [application guide](../../../../may.app/design/operator-application.md)
and [SDK contract](../../2a-design/sdk.md).

The two production modules have nine fewer lines. Tests share one small journal
fixture; the synthetic harness gains denial cases and uses current Conversation
delivery, App `alex` for Evaluation, its ordinary root and trusted criteria, and
a schema-valid synthetic judgment. No new state, service or framework is added.
The total test/harness diff grows; this is contract cleanup, not a claim of a
large code reduction or measured runtime/token savings.

## Verification and limits

- May App suite: **194 passed, one pre-existing skip**, across 19 files. Coverage
  includes current Host-shaped decisions, forged/legacy attribution, human-only
  policy, mismatched proposals, changed current Conditions, rejected/deferred
  decisions, unchanged Git on denial, idempotent application and activation.
- May typecheck passed. Changed verifier, source-application and shared fixture
  formatting passed; `git diff --check` passed.
- `bun run check:may-design` passed against the merged Host source, including
  executable App examples and the model-surface check. Its existing unclassified
  `reports` warning remains. All eleven listed composition scenarios passed.
- The package-wide formatting gate still reports 16 files. Checking their exact
  unchanged base revisions reproduces all 16 failures. Unrelated formatting was
  preserved, including old portions of the activation test.

The composition uses real Host SQLite/Tasks, human-action cards, trusted-ingress
stamping, durable Conversation approval delivery, journal reads, Condition
wakeups, temporary Git application, Task events, public reads, command routing
and cross-App review admission/return. Telegram HTTP, the reload callback and
the evaluator judgment are synthetic. They make no real provider/model call and
do not establish live deployment or improved model judgment.

| Scenario | Verified outcome |
| --- | --- |
| `positive` | Exact approval applies the candidate, one pinned synthetic reload completes and review of fresh work is requested. |
| `full-follow-up` | The exact independent review returns and the owner records completion. |
| `reject`, `defer` | Host records the decision; the source command denies mutation. |
| `stale-approval`, `conditional-approval` | Input remains Conversation; no formal approval or source mutation. |
| `inconclusive-activation` | Missing loaded-source identity leaves adoption incomplete without requesting Evaluation. |
| `source-advanced-after-activation` | Later ordinary source commits preserve the already-issued operation's exact activated identity; no additional reload or authority is inferred. |
| `different-review-return` | A result for different selected evidence does not settle the original review. |
| `subject-advances-before-review` | A finished review refusal becomes an inconclusive outcome rather than an endless external wait. |
| `subject-advances-after-review` | An already-returned exact review is retained when the subject later changes; no replacement request is fabricated. |

Every composition run also rejects a copied Host stamp published without trusted
ingress authorization. Source application refuses cancelled, closed,
new-generation and superseded owner snapshots before mutation.

Reproduce from the Apps checkout with matching, dependency-ready Host source:

```sh
HOST_CANDIDATE=/path/to/host APP_CANDIDATE=/path/to/apps \
  SCENARIO=full-follow-up RESULT_PATH=/tmp/approval-full-follow-up.json \
  bun projects/may.app/scripts/improvement-approval-composition.ts
```

Use each scenario above with a separate result path. All writes belong to
temporary databases, Git repositories and fixture reports; installed runtime
artifacts are not test inputs. Activate matching Host/SDK/App source only through
the ordinary separately authorized release path.
