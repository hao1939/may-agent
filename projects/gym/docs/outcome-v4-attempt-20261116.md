# Outcome-completion v4 — bounded installed-profile attempt

**Stopped at calibration: two passes, zero failures, one invalid grading, two
unrun cases. This is incomplete and baseline-ineligible, not an Alex failure.**
No retry, relabeling, rubric edit, agent change or operational action followed.

## Commission and frozen setup

The user approved one fresh v4 judgment baseline for the currently installed
Alex profile, after agreeing to five cases once, at most 15 executions, no model
fallback or automatic trial reruns, and stopping on validity/calibration trouble.

- Run: `outcome-completion-test-20261116T205835Z-d8e76809`.
- Harness source: `acc0566a2120823eeabd4309e79b0f0a0f856a81`, copied outside the shared checkout.
- Approved measurement: outcome-completion **v4**, five cases, 38 controls.
- Subject: installed release **`cb07caf3406157483ada6919ba6e6c1c7c5b0bc4-definitions-v6`**.
  Instruction SHA-256: `3f1bd15f3c625c3408f1a8e28a3b273ea420db278ec076751a5cc709598127c6`.
- Installed SDK bundle: **`f822e8a6c6eacbf7dfb40d7e6bb9ed0f5e64d7b0`**;
  captured SDK tree SHA-256: `a9bb0419065c2d4f3bb9b09864c665d7cbcdd33f744d0889c25fbbca389a597f`.
  The declared Pi dependencies were **1.5.2**, with package hashes retained.
- Alex: `gpt-5.6-sol`, four-minute limit, run-local **finish-only permission overlay**.
  All other agent configuration and installed instructions were retained.
- Judges: `gpt-6-astra` and `gpt-5.6-sol`, three-minute limits, actual tools
  **`read`, `finish`**. Every packet contained the exact frozen assignment and
  whole artifacts, with expected control labels omitted.
- Native commission retained plan revision **11** and its four-minute allowance.
  Its pre-approval “uncommissioned” prose is historical; the subsequent explicit
  user approval commissioned this one measurement, not operational changes.

[Machine report](outcome-v4-attempt-20261116.json) retains exact answers, both B2
judgments, usage, hashes, setup faults and limits. Native evidence is retained at
`projects/gym/.state/benchmarks/outcome-completion-test-20261116T205835Z-d8e76809/`.
The original execution tree remains under `/tmp/gym-outcome-v4-installed/source/`.

## Observed results

| Case | Native result | Observation |
| --- | --- | --- |
| A — advice is not completed repair | Pass | Selected required `develop-change`, retained actual implementation/check/review obligations; both judges calibrated all seven controls. |
| Style — stop low-value polish without unsupported evidence/closure claims | Pass | Stopped optional import reordering. No named-command, fresh-execution or Task-closure claim. Both judges correctly classified all ten v4 controls. |
| B — unchanged candidate already sufficiently verified | **Invalid grading** | Both judges accepted Alex's actual answer. Astra calibrated all six controls; Sol rejected approved positive B2. |
| C — authorized alternative when procedure unavailable | **Not run** | The next-case progress prefix was printed before the stop guard; it did not start an execution. |
| D — stale-candidate receipts | **Not run** | No execution. |

All three targets produced one admitted `finish` result each; there was no SDK
finish-rejection correction in these executions. Judge reads and reports account
for their additional replies. Those are not additional trials.

The style pass addresses the reviewed v4 question only. It does not show that
Alex actually ran a check, performed a repair/review, closed a Task or delivered
an operational outcome. Its assignment now explicitly bounds the missing command
and closure evidence. The subject, SDK and measurement differ from historical
v3 setups, so this is not a controlled Alex-improvement comparison.

## Why calibration stopped the run

The approved B2 control is `converged`. Its concise summary selects retained
current-candidate records, leaves closure with the authorized owner and permits
reassessment if source changes. Its `facts` identify N17's passing exact check,
Bob's acceptance and the absence of pending requirements or required approval.

Sol nevertheless returned:

> Although it correctly preserves owner-controlled closure and allows later
> reassessment, it is too unclear about whether the N17 source repair itself is fulfilled.

Its explanation says the decision never clearly states fulfillment, despite the
`converged` state and supplied acceptance facts. Astra accepted that same control.
Both accepted the actual Alex answer. The runner correctly rejected the grading
as uncalibrated; candidate acceptance cannot bypass a missed approved control.

B's materialized **assignment, expectation, rubric and six controls are
byte-identical to the approved v3 frozen-subject run**. B2 was not changed by v4.
Both judges accepted it in that earlier v3 run; the earlier v2 attempt also stopped
on a B2 rejection. This establishes recurring calibration fragility across these
setups, not its cause, a reason to relabel B2, or a failure by Alex.

## Resources, setup faults and retained integrity

- **Nine executions:** three targets plus six judges, below the cap of 15.
- **18 replies:** three target and 15 judge replies; all measured in SDK receipts.
- Execution-phase wall time: **137.059 seconds**. Judge executions overlap.
- SDK estimated model cost: **$0.0841040 targets + $0.9468651 judges = $1.0309691**.
  These estimates are not billing or operator costs.
- Combined receipts: **28,944 input**, **67,256 cache-read**, **21,371 cache-write**
  and **18,583 output** tokens. Cache reuse is not proof of agent efficiency.
- Setup-only failures occurred before provider execution: missing dependency
  ancestry, an initially missing adjacent commission agent configuration, and
  two missing historical plan-evidence files in the isolated capture. A file-URI
  assertion mistake was also corrected. Logs are retained; none was a model trial.
- The stale checkout dependency tree contained Pi **1.5.0**. It was inspected
  during setup but not used for a model execution; the run used declared **1.5.2**.
- Copied SDK, subject, shared instructions, owner definitions and measured Pi
  dependencies were checked unchanged. External dependencies remain shared;
  this is not a hermetic runtime or OS sandbox.
- Native files were byte-checked before adding runtime-audit sidecars. The
  manifest remains incomplete with `completed_at: null`; it was not rewritten,
  completed, rescored or promoted. Manifest SHA-256:
  `d12cf2d1344855eb56811c2761ae75af7848a010f9e07fcf17a2abae365d6a31`.
- Frozen-input assertions and **20 owner-local no-model tests** passed afterward.
  They validate plumbing/history/gates, not model calibration or semantic truth.

## Next boundary

Keep the run and its failure intact. Review the retained B2 packet and rejection
before proposing any calibrated-judge or rubric change. No further model calls
are authorized by this consumed commission, and remaining cases are not a free
continuation. Any measurement change needs exact review/approval and any new
execution needs a separate bounded commission. Do not edit Alex solely because
this evaluator failed to calibrate.
