# Measurement identity repair — 2026-11-16

Alex’s retained outcome-completion v3 run can be selected as its judgment baseline without rerunning models. The five-case run `outcome-completion-test-20261116T154647Z-811047b3` has 5 pass, 0 fail and 0 invalid, with approved labels and calibrated controls. This establishes a measurement under its recorded harness; it does not demonstrate improved Alex behavior or useful operational delivery.

## Problem and repair

The commissioning fingerprint captured every file in the benchmark owner directory. A later validation-results paragraph in `CALIBRATION-REVIEW.md` therefore invalidated unchanged measurement inputs. Historical reporting also required today’s execution harness to match the recorded harness, so changing reporting code itself removed historical coverage.

Historical reading now authenticates the original commissioning capture and retained inputs, then compares the actual current suite, materialized cases, fixtures, rubrics, controls, normalized labels, scorer and semantic judge definitions. It validates the frozen harness integrity without requiring today’s source to have the same harness fingerprint. The original fingerprints, manifests, inputs, verdicts and resources remain intact; no run was rescored.

The report exposes `harness_matches_current`. This baseline reports `false`: future candidate verification must execute with the recorded harness, or a separately commissioned fresh baseline must establish a new matched comparison. Default verification still rejects a changed harness before model execution. Selecting this historical baseline does not certify compatibility with today’s default runner.

## Verification

- Focused measurement-history and agent-plan tests: 32 passed, 0 failed, 273 assertions. Coverage includes prose-only edits, draft-truth rejection, harness mismatch reporting, strict verification rejection, and measurement/retained-input corruption.
- Full `bun run gym:check`: strict TypeScript and build passed; 396 Bun tests and 6 Node/scorer tests passed; 122 active cases in 13 purpose benchmarks had no structural errors; 1,488/1,488 benchmark-review checks passed.
- Evidence, before copies, test logs and final validation: `.state/gym-measurement-identity-20261116-01/`.
- No additional target or judge executions were performed. The repair preserves the incomplete, invalid v2 history as well as the complete v3 measurement.

The source repair remains local within the existing uncommitted Gym planning work. Alex’s plan advances from revision 8 to 9 and selects only the outcome-completion v3 baseline. Improvement-stage-selection remains without an approved selected baseline; owner decisions remain empty.

## Next evidence

Observe Alex’s next useful authorized task through verified delivery or a supported disposition. Retain the Task and attempt identity, candidate/check/review evidence, human corrections, elapsed time and model-cost scope. The existing system-wide daily review remains the observation route, due 2026-11-17 09:00 UTC. No hosted request, new scheduler, production definition change, integration or activation is part of this repair. The retired reporting incident and its consumed allowance remain unchanged.

The older [v3 evaluation report](outcome-v3-evaluation-20261116.md) records the fingerprint limitation as observed at execution time; this repair resolves that bookkeeping limitation. Its separate provenance, operational-transfer and repeated-run limitations still apply.
