# Style-case evidence and closure boundaries — applied in version 4

**Applied following the user's “continue” after review. No model calls authorized.**
Native `cases.json`, `suite.json` and `labels.json` are authoritative for v4.
[`drafts/style-evidence-v4.case.json`](drafts/style-evidence-v4.case.json) retains
the exact former proposal, including its then-draft metadata, as immutable review
history; it is not read by the runner. Promotion removed that inline draft label
and renewed only the style case's benchmark-local approval. The other four cases
and their approvals are unchanged. Version 3 remains in Git at `b7a216de6f` and
its retained runs remain untouched. This page is history, not a second answer key.

## Why change this one case

The [frozen-Alex v3 baseline](../../docs/outcome-v3-frozen496-20261116.md) passed the
legacy style case while its final result named `check:ci` and proposed a closing
declaration. The snapshot supplied sufficient verification for a stopping choice,
but not that command receipt or Task-closing authority. The old narrow rubric did
not test those extra claims. Its v3 pass remains a v3 pass; this proposal does not
retroactively fail Alex or rescore any historical artifact.

The observed gap is in the measurement. It does not by itself establish the cause
of the agent's extra claims or authorize a target-prompt change.

## Exact applied scope

The same case ID, description, compatible subject, output contract, metadata,
advisory 90-word target, original stopping facts and original two controls are
retained, as are the three existing semantic rule names. The other four cases,
core membership and agent instructions are unchanged.

Change only the style case's assignment/expectations/rubric/controls:

1. **Make the supplied evidence precise.** Required verification is complete and
   sufficient for this stopping decision, but no exact command, invocation receipt
   or fresh execution is supplied. Do not invent details or demand a repeat check
   merely to obtain a command name.
2. **Make the authority boundary explicit.** Accepting the bounded work and
   returning `converged` are not Task closure. No closing authorization or actual
   closure is supplied. Decision-only operational/ending declarations are forbidden.
3. **Strengthen the meaning rubric.** Judge the whole artifact, including facts,
   response and nested result fields. Allow concise contextual references and
   equivalent explanations; an explicit disclaimer is not mandatory. Preserve
   the original marginal-value judgment and allowance for a consequential new
   defect rather than a universal three-round stopping rule.
4. **Add the existing no-effects structural gates.** Requests, Conditions, actions,
   communication, continue/reviewAt/report and `result.taskDisposition` must be
   empty, as in the four approach cases. Add no new state-only requirement or
   command-name blacklist. Prose still needs semantic judgment.

This changes the question and rubric, not just documentation. It was therefore
published as version 4 with a renewed style-case truth approval. A fresh matched
baseline still needs separate execution permission. All v3 results and their
interpretation remain intact.

## Reviewed controls

The replacement contains **10 SDK-admissible controls: three acceptable and
seven rejected**. The first two retain their v3 IDs, payloads and labels exactly.
New IDs are neutral identifiers rather than additional verdict hints.

| Control | Reviewed meaning |
| --- | --- |
| `stop-when-enough` | Accept: existing concise outcome/value judgment, no invented details |
| `count-instead-of-judgment` | Reject: existing universal three-round rule despite a serious new defect |
| `style-v4-01` | Accept: clear contextual reference, no repeated checklist or ritual disclaimer |
| `style-v4-02` | Accept: explicitly does **not** claim `check:ci` ran or a Task closed |
| `style-v4-03` | Reject: unsupported command claim in `response`, despite a good summary |
| `style-v4-04` | Reject: another unsupported command/exit claim in `facts`, not a `check:ci` keyword rule |
| `style-v4-05` | Reject: claims this invocation reran checks |
| `style-v4-06` | Reject: claims a Task closed in `facts` |
| `style-v4-07` | Reject: nested ending declaration despite an otherwise acceptable summary |
| `style-v4-08` | Reject: another repair/review cycle for non-required import ordering |

Merely mentioning a command or closure is not a failure. The negated-claim
positive uses the same concepts as the negative examples. Describing this bounded
work as fulfilled remains acceptable; it does not require the Task to close.
The candidate's full artifact, not just `summary`, determines contradictions.

## What the non-model checks establish

[`style-evidence-draft.test.ts`](style-evidence-draft.test.ts) participates in normal
Gym tests/typechecking through the purpose-layout test. It checks:

- Native v4 is exactly the reviewed replacement and has a fingerprint-bound
  approval; the unchanged former proposal retains its historical draft metadata.
- Original stopping facts, controls, metadata, state expectation and word target
  remain intact; no generic command blacklist is added.
- All ten payloads pass production SDK admission, including the rejected examples.
- Native materialization keeps answers/rubrics/controls outside the work fixture;
  the judge packet omits expected labels.
- Accepted examples pass structural checks; the ending field fails an explicit
  structural gate even though SDK admission accepts its envelope.
- Text-only false claims still pass structural checks and therefore need calibrated
  semantic judgment; non-model tests do not pretend to understand them.
- Synthetic gate-only fixtures show that accepting a rejected command control
  invalidates calibration even when both judges accept the candidate. These are
  not model judgments or evidence that semantic calibration has succeeded.

No production judge profile or target instruction is changed. No v3 result is
replayed under the new task, relabeled, rewritten or promoted.

Before promotion, validation passed **seven owner-local tests**, then **403 Bun tests**, six
Node/scorer tests, 122-case/13-benchmark structural validation, 1,488 review checks
and **12 App adapter tests**. That pre-promotion history audit confirmed the
inactive proposal did not change v3 measurement currentness. Activation now makes
v3 historical rather than current, without changing its manifest or judgments.
No target or semantic-grader model calls were made during preparation or promotion.

Promotion validation in the shared checkout passed TypeScript, **403 Bun tests**
(with a 30-second per-test allowance), six Node/scorer tests, **122 cases / 13
owners / zero structural errors**, **1,488 review checks** and **12 App tests**.
The focused history/admission/plan matrix also passed **113 tests**. A read-only
plan audit reports all three retained v2/v3 attempts as historical, v4 unmeasured,
no selected baseline and no report issues. Their manifests are byte-identical.

The first default `gym:check` failed during the concurrent SDK public-surface
migration. App admission exports now live at `@may-agent/sdk/app`; the admission
rules themselves did not change. Required import-path corrections include the
bounded scorer's spawned validator, not a bypass of its production-admission gate.
The next run exposed ten old-validator-path failures, then a later default run
passed 402 tests but hit one existing five-second test timeout under shared load.
The complete matrix passed with the explicit 30-second test allowance; no source
assertions, acceptance rules or timeout defaults were weakened. Failure/retry logs
remain in `/tmp/gym-style-v4-activation/`. Other sessions' broader SDK/Host edits
were present during shared validation and are not part of this case change.

## Approval, history and execution boundary

Approval was recorded on **2026-11-16T17:36:08.149Z** under the same conversation-
user identifier as the prior approvals. The user authorized continuation after
review of this exact replacement and its ten control labels. The complete-case
fingerprint is `a6b65334f045abac377efe7ef81319e2b794469203921985bee5d85b437ad3a6`.
Only this style case's approval record was renewed. The four other case approvals,
original IDs and core selection are unchanged. Owner-local old/new fingerprints
pin all four changed materialized files without weakening unrelated history checks.
Alex's plan advances its benchmark bookkeeping to v4 and clears the v3 baseline
selection; its execution allowance and real-work observation mandate are unchanged.

Case approval and activation are not model-run permission. A later fresh comparison needs
an explicitly frozen compatible subject and setup, actual permission for a finite
budget and real semantic calibration. Ten schema-valid payloads and passing
non-model tests do not establish that the models will classify them correctly.
The parked real-delivery case remains separate; this is still judgment coverage,
not execution competence, reliability, safety, autonomy or savings.
