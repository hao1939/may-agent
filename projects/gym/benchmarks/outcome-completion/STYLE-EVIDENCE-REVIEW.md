# Style-case evidence and closure boundaries — inactive version-4 draft

**Prepared for review, not approved or active. No model calls authorized.**
The proposed replacement is
[`drafts/style-evidence-v4.case.json`](drafts/style-evidence-v4.case.json), in the
normal inline-case format. It is not read by native discovery or the runner.
Current `cases.json`, `suite.json`, `labels.json`, the five-case v3 suite and its
retained runs remain unchanged. This page is review history and an index, not a
second maintained answer key.

## Why change this one case

The [frozen-Alex v3 baseline](../../docs/outcome-v3-frozen496-20261116.md) passed the
legacy style case while its final result named `check:ci` and proposed a closing
declaration. The snapshot supplied sufficient verification for a stopping choice,
but not that command receipt or Task-closing authority. The old narrow rubric did
not test those extra claims. Its v3 pass remains a v3 pass; this proposal does not
retroactively fail Alex or rescore any historical artifact.

The observed gap is in the measurement. It does not by itself establish the cause
of the agent's extra claims or authorize a target-prompt change.

## Exact proposed scope

Retain the same case ID, description, compatible subject, output contract,
metadata, advisory 90-word target, original stopping facts and original two
controls. Retain the three existing semantic rule names. The other four cases,
core membership and agent instructions are outside this change.

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

This changes the question and rubric, not just documentation. It therefore needs
new truth approval, version 4 on promotion and a fresh matched baseline. Keep
all v3 results and their interpretation intact.

## Proposed controls

The replacement contains **10 SDK-admissible controls: three acceptable and
seven rejected**. The first two retain their v3 IDs, payloads and labels exactly.
New IDs are neutral identifiers rather than additional verdict hints.

| Control | Proposed meaning |
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

- Native v3 ownership/approval fingerprint remains authoritative, and the proposed
  replacement stays draft with null reviewer/time.
- Original stopping facts, controls, metadata, state expectation and word target
  remain intact; no generic command blacklist is added.
- All ten payloads pass production SDK admission, including the rejected examples.
- Proposed materialization keeps answers/rubrics/controls outside the work fixture;
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

Validation passed **seven owner-local tests**, then **403 Bun tests**, six
Node/scorer tests, 122-case/13-benchmark structural validation, 1,488 review checks
and **12 App adapter tests**. A read-only history audit confirmed the selected v3
measurement remains current despite this inactive draft; its existing recorded-
harness comparison boundary is unchanged. The active v3 case/suite/label files
and retained baseline manifest were checked byte-for-byte unchanged. No target
or semantic-grader model calls were made.

## Promotion and execution gates

If the exact replacement and labels are approved, publish **outcome-completion
v4**, replacing only this style definition and removing its inline draft label.
Renew only its benchmark-local approval fingerprint/record; retain the four
unchanged case approvals, original IDs, core and archived v3 history. Extend the
owner-local migration pins for the four changed materialized files without
weakening unrelated historical equality checks.

Approval of the draft is not model-run permission. A later fresh comparison needs
an explicitly frozen compatible subject and setup, actual permission for a finite
budget and real semantic calibration. Ten schema-valid payloads and passing
non-model tests do not establish that the models will classify them correctly.
The parked real-delivery case remains separate; this is still judgment coverage,
not execution competence, reliability, safety, autonomy or savings.
