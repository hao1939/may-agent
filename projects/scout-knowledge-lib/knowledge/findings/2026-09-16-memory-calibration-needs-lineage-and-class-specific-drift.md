<ai_context>
summary: "RE-call binds memory-retrieval calibration to an exact tenant, index generation, pipeline, corpus, and labelled-query digest. Its carry-forward path replays the original labels against a rebuilt index and checks fixed-threshold false-confirm and false-abstain rates because class ordering alone can remain perfect after the operating boundary has stopped separating answerable from unanswerable queries."
triggers: ["agent memory calibration", "retrieval abstention", "calibration drift", "threshold carry-forward", "false confirmation", "generation-bound retrieval"]
last_updated: "2026-09-16"
</ai_context>

# Memory calibration needs lineage and class-specific drift checks

**Date:** 2026-09-16  
**Source:** GitHub repository observation  
**Repo:** [GiulioDER/RE-call](https://github.com/GiulioDER/RE-call)  
**Inspected revision:** [`96f1112acc69090f1688394870c63e6e222642a1`](https://github.com/GiulioDER/RE-call/commit/96f1112acc69090f1688394870c63e6e222642a1)

## Signal

RE-call is a concrete implementation of abstaining memory retrieval rather than a repository-description-only claim. Its trust path resolves a calibration artifact before constructing or invoking the retriever. In strict mode, a missing, stale, dependency-failed, or lineage-mismatched calibration raises a typed refusal before `retriever.search(...)`; in degraded mode, the result instead uses an explicitly uncalibrated default and clears the calibration identity. The code also compares both model name and embedding dimension, avoiding the unsafe shortcut that equal vector dimensions imply comparable scores.

The stronger signal is how the repository handles index rebuilds. Calibration artifacts bind to an exact tenant, generation, pipeline fingerprint, corpus fingerprint, labelled-query-set digest, and publication state. A rebuilt generation therefore does not silently inherit the old threshold. The `carry_forward` implementation:

1. requires a published, certified parent artifact;
2. rejects pipeline changes, unchanged corpora, excessive one-step corpus delta, and excessive cumulative delta across a carry-forward chain;
3. verifies the stored labelled query set against its digest;
4. re-scores those labels against the child generation;
5. keeps the inherited threshold fixed and measures false-abstain and false-confirm rates at that operating point;
6. creates a rejected artifact if either certification or the class-specific error bound fails; and
7. records parent identity, inherited and diagnostic refit thresholds, per-class errors, one-step delta, and cumulative delta in checksummed provenance.

The implementation's key counterexample is important: answerable and unanswerable scores can both shift upward while remaining perfectly ordered. A threshold-free separability measure can then stay excellent even though every unanswerable query crosses the old threshold. The repository's test fixture deliberately produces that case and expects carry-forward rejection when false-confirm rate exceeds the bound.

## Durable implication

A retrieval confidence threshold is not a portable scalar. It is a decision artifact whose validity depends on the data generation, scoring pipeline, labelled evidence, and chosen operating point.

Agent-memory systems that evolve their index should separate at least three checks:

- **identity binding:** does this calibration belong to this tenant, model, pipeline, corpus generation, and label set?
- **ranking quality:** do answerable and unanswerable classes remain ordered?
- **operating-point validity:** at the frozen threshold, what are false-confirm and false-abstain rates now?

Only the third check can show whether an inherited abstention boundary still makes the intended decision. Replaying labels is therefore evidence for reuse; a small corpus diff or good AUC is not. Chained reuse also needs lineage-wide drift accounting so many individually small updates cannot indefinitely preserve authority from an obsolete original fit.

A useful response contract should expose these facts independently: calibration status and identity, trust/refusal state, reason code, and whether the threshold was measured on this generation or inherited after replay. Collapsing them into one `confidence` number invites clients to treat an uncalibrated score as certified authority.

## Evidence and limits

- The pinned [`docs/CALIBRATION.md`](https://github.com/GiulioDER/RE-call/blob/96f1112acc69090f1688394870c63e6e222642a1/docs/CALIBRATION.md) documents immutable generation binding, explicit publication, fixed-threshold carry-forward, class-specific error checks, and the distinction between drift screening and a replay probe.
- The pinned [`recall/calibration_v2.py`](https://github.com/GiulioDER/RE-call/blob/96f1112acc69090f1688394870c63e6e222642a1/recall/calibration_v2.py) implements digest verification, pipeline and corpus checks, fresh label scoring, fixed-threshold false-confirm/false-abstain measurement, cumulative-delta enforcement, rejected artifacts, and checksummed carry-forward provenance.
- The pinned [`recall/trust.py`](https://github.com/GiulioDER/RE-call/blob/96f1112acc69090f1688394870c63e6e222642a1/recall/trust.py) places strict calibration and model-lineage refusal before retriever construction and corpus search.
- The pinned [`tests/test_calibration_carry_forward.py`](https://github.com/GiulioDER/RE-call/blob/96f1112acc69090f1688394870c63e6e222642a1/tests/test_calibration_carry_forward.py) includes the shifted-score counterexample and provenance/lineage assertions.
- This observation verifies repository structure and pinned source behavior, not a deployed service. Scout did not run the PostgreSQL-backed test suite or independently reproduce the repository's reported empirical drift measurements.
