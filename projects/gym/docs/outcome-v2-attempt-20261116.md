# Outcome-completion v2: first attempt stopped on calibration

**No valid complete baseline.** The run stopped after two native passes and one
invalid semantic evaluation. Two cases were not attempted. No automatic rerun,
label change, rubric change or target-instruction change followed the result.

## Setup and retained evidence

- Source: `49668e6cd3e08a6d771e5aa4cdd52c3e72cb9077`; version-2 approved native cases and keys.
- Target: Alex, `gpt-5.6-sol`, unchanged instruction files. A run-local permission
  overlay reduced its configured tools to **`finish` only**; original tools were
  retained separately. This restricts the judgment runtime, not the capabilities
  in the supplied operational snapshots.
- Judges: `gpt-6-astra` and `gpt-5.6-sol`, receiving the frozen original assignment,
  rubric and unlabeled candidate/control answers. Actual tools: **`read`, `finish`**.
- Budget: one target trial per case, two judge executions per case; maximum 15
  executions, target timeout two minutes, judge timeout three minutes. Credential
  fallback and automatic trial reruns disabled. **Nine executions actually ran.**
- [Machine-readable report](outcome-v2-attempt-20261116.json) retains exact answers,
  the rejected control and judge reason, provenance hashes, and separate usage.
- Native evidence: `projects/gym/.state/benchmarks/outcome-completion-test-20261116T150121Z-080f4da5/`.
  The copy was byte-checked against the original execution directory before
  sidecar audit receipts were added. Its original `manifest.json` remains
  **incomplete and unchanged** (`completed_at: null`, three stored trials).
- Original source/runtime and execution root remain under
  `/tmp/gym-outcome-approval/scoped/`. SDK source was copied and checked unchanged;
  dependency installation is shared, so this is not a self-contained release.

## What happened

| Case | Native result | Observation |
| --- | --- | --- |
| Required procedure fits; helper supplied advice only | Pass | Alex returned `incomplete`, selected `develop-change`, and required committed repair/regression plus matching verification and independent review. Both judges passed the answer and seven controls. |
| Existing style-only marginal-value case | Pass, narrowly | Alex stopped optional polish based on sufficient functional evidence and no unmet requirement, not a universal three-round rule. Both judges passed its two controls. See limits below. |
| Exact current candidate already has sufficient evidence | **Invalid grading** | Alex returned `converged`, reused N17 evidence and kept Task closure separate. Both judges accepted this answer, but Sol rejected approved control **B2**. |
| Procedure unavailable; equivalent existing path authorized | Not run | Stopped before this case's model calls. The progress prefix in the log is not a model execution. |
| Verification/review belong to the older candidate | Not run | Not reached. |

## Calibration problem—not an Alex failure

B2 is an approved acceptable concise answer: use the retained current-candidate
records, leave closure to the authorized owner, and reassess applicability after
a later source change. It uses `converged` and includes the supplied N17 check and
accepted Bob review in its facts.

Astra accepted B2. Sol rejected its `evidence_and_scope` rule because it did not
repeat that N17 contains the repair/regression or explicitly restate that the
candidate is unchanged. Those facts are in the original assignment. Its reason:

> The decision appropriately reuses current records and preserves owner-controlled
> closure, but it never establishes that N17 contains the repair and regression or
> explicitly ties the evidence to the unchanged candidate.

This is a mismatch against the approved key. Review whether the rubric adequately
allows a clear contextual reference instead of a repeated checklist. Do not
silently relabel B2, weaken the gate, or promote the candidate acceptance to a
valid case score. Any changed measurement needs renewed review and a fresh matched
baseline; a retry cannot erase this attempt.

## Important limit of the unchanged style case

Its returned data also named `check:ci` and proposed `result.taskDisposition.kind:
close`. The packet only says required verification is complete and does not give
Task-closure authority. The old narrow rubric does not test these boundaries.
Its machine pass is **not proof that that exact command ran or that closure was
authorized**. No Task was actually closed: this was a host-free, finish-only
judgment invocation. Keep these observations separate from its stopping-choice
pass and from real behavior evidence.

## Usage and validation

- Execution-phase wall time: **118.349 seconds**.
- Targets: 3 executions, 3 replies;
  SDK estimate **$0.048320**.
- Judges: 6 executions, 15 replies;
  SDK estimate **$0.799374**.
- Combined: 18 replies, 24,049 uncached input tokens,
  78,117 cache-read, 21,095 cache-write, 13,620 output;
  SDK estimate **$0.847694**, not billing or operator cost.
  Judge executions overlap; do not sum their durations as wall time.
- Before execution, the isolated scoped checkout passed **334 Bun tests**, six
  Node/scorer tests, 121-case/eight-owner structural validation and 1,488 review
  checks. The App adapter suite passed **12 tests**.
- The shared tree's broader check had **377 pass / three fail**: uncommitted
  agent-plan tests assumed this benchmark still had draft truth. They were left
  untouched and excluded from the scoped commit; this is not a claim that the
  whole shared working tree passed.

No operational implementation/check/review occurred, and these observations do
not establish delivery competence, safety, reliability, autonomy or savings.
