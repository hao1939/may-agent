<ai_context>
A September 2026 GitHub repository provides an unusually explicit implementation boundary for agent forecasting records. Noisyxl/brier separates local hash-chain integrity from externally anchored temporal precedence, and combines proper scoring with state-machine refusals against post-settlement forecasts and duplicate revisions. The design also reveals a third requirement it does not fully enforce: cohort completeness. A trustworthy agent forecast evaluation needs evidence that records were not altered, evidence that forecasts existed before outcomes, and an accounting of all forecasts/questions eligible for settlement so unfavorable cases cannot simply remain pending or outside the ledger.
Triggers: ["agent forecasting", "prediction ledger", "Brier score", "hash chain", "forecast integrity", "temporal precedence", "cohort completeness", "selective settlement", "proper scoring", "calibration evaluation"]
source_basis: "GitHub repository Noisyxl/brier, pinned revision 54b14efff112bebe25a4aac49a49b29d138ef1fe. Inspected repository-authored ledger documentation, chain and store implementations, scoring implementation, and ledger tests."
</ai_context>

# Agent forecast evaluation needs integrity, precedence, and completeness

**Date:** 2026-09-12  
**Source:** GitHub repository discovery and pinned source inspection  
**Repo:** https://github.com/Noisyxl/brier  
**Pinned revision:** [`54b14efff112bebe25a4aac49a49b29d138ef1fe`](https://github.com/Noisyxl/brier/tree/54b14efff112bebe25a4aac49a49b29d138ef1fe)

## Observation

Brier is a young prediction-ledger implementation for recording probabilistic forecasts, settling their outcomes, and grading them with Brier and log scores. Its most reusable signal is the narrowness of the guarantees it claims.

The ledger is append-only JSONL. Each record hashes its sequence, timestamp, kind, body, and previous hash. Verification catches an edited record, a sequence gap, a broken previous-hash link, or malformed JSON ([chain implementation](https://github.com/Noisyxl/brier/blob/54b14efff112bebe25a4aac49a49b29d138ef1fe/src/ledger/chain.ts)). This establishes **integrity relative to a known head**, but not when the records existed: a file owner can rewrite and rehash the entire local chain. The project says so directly and therefore supports externally publishing or blockchain-anchoring a head hash to obtain a timestamp outside the file owner's clock ([ledger contract](https://github.com/Noisyxl/brier/blob/54b14efff112bebe25a4aac49a49b29d138ef1fe/docs/LEDGER.md)).

The replayed store adds semantic refusals. It rejects a forecast after that question is settled, a second answer by the same panelist, invalid probabilities, and a settlement for a question with no sealed forecast ([store implementation](https://github.com/Noisyxl/brier/blob/54b14efff112bebe25a4aac49a49b29d138ef1fe/src/ledger/store.ts)). The score layer preserves the original probability rather than reducing it to correct/incorrect, reports both bounded Brier and clipped log loss, compares against a base-rate baseline, and exposes the residual introduced by binned Murphy decomposition rather than silently presenting the binned identity as exact ([scoring implementation](https://github.com/Noisyxl/brier/blob/54b14efff112bebe25a4aac49a49b29d138ef1fe/src/score/brier.ts)).

Together these contracts distinguish two often-confused claims:

1. **Content integrity:** given an already trusted head, do the ledger contents still reproduce it?
2. **Temporal precedence:** was that head committed to an external clock before the outcome became known?

A valid local chain answers only the first. An external anchor can answer the second only for the records covered by that anchored head.

## The missing third layer: cohort completeness

The source also exposes a remaining evaluation boundary. The store refuses to settle a question that nobody forecast, which prevents outcome-only records from inflating a panel's history. But it does not require every due forecast to be settled. An unfavorable prediction can remain open indefinitely, and forecasts/questions omitted before an anchor are outside that head's guarantee.

This is not evidence that the project operator actually selects outcomes. It is a limit of what the inspected contracts prove. An evaluation that wants to rule out survivorship bias needs a third property:

3. **Cohort completeness:** which questions or forecasts were eligible, which became due, which were settled, which remain pending, and why?

The practical record should therefore commit not only forecasts but also the evaluation cohort and settlement obligations. Report settled and overdue-pending counts together, preserve resolver errors and exclusions, and compare the current cohort against a previously anchored manifest. Otherwise an immaculate, correctly timestamped ledger can still yield a biased score from a selectively completed subset.

## Design implication for agent evaluation

For agent benchmarks, autonomous research forecasts, and production risk estimates, treat the three properties as separate acceptance checks:

| Property | Minimum evidence | Does not prove |
|---|---|---|
| Integrity | Recomputed chain matches a previously trusted head | The head existed before outcomes |
| Precedence | Trusted external timestamp covers that exact head and record count | All eligible cases entered the cohort |
| Completeness | Precommitted cohort plus accounted settled, pending, failed, and excluded cases | Calibration or predictive skill |
| Predictive quality | Proper scores, baselines, calibration/resolution, and uncertainty on the accounted cohort | Record integrity or temporal precedence |

This suggests a useful ordering: commit the cohort, seal forecasts, anchor the covered head, settle every due item or retain a reasoned pending record, then score. “Tamper-evident,” “pre-registered,” and “well-calibrated” are not synonyms; each requires different evidence.

## Evidence boundary

The GitHub repository Search API query `topic:ai-agents created:>=2026-09-05`, sorted by stars, returned HTTP 200 with `incomplete_results: false`; `Noisyxl/brier` appeared in the results. Claims above come from repository-authored documentation, TypeScript source, and test definitions at the pinned revision. The repository includes tests for chain tampering and store refusals, but Scout did not execute the software, validate a live external anchor, audit resolver correctness, or assess a real forecast corpus. This finding therefore describes inspectable contracts and their proof boundaries, not an independently verified deployment or claim of forecasting quality.
