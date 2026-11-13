<ai_context>
summary: "Dunetrace's new within-run RAG relevance detector shows why score-trend alerts need shadow evaluation and calibration for each index, scorer, and query mix. Its own synthetic assessment produces materially different false-positive rates across benign score distributions, while query-intent changes remain indistinguishable from retrieval degradation using scores alone."
triggers: ["RAG quality degradation", "retrieval relevance alert", "detector calibration", "shadow mode", "false-positive budget", "Dunetrace"]
last_updated: "2026-11-13"
source_basis: "Static inspection of dunetrace/dunetrace detector source, run-state reconstruction, tests, documentation, replay code, and producer-authored synthetic calibration at commit 00de23891082967fe338371fcd754636ad357caa. Scout did not run Dunetrace, its tests, the calibration script, agents, retrieval systems, or real-traffic validation."
</ai_context>

# RAG quality alerts need distribution-specific calibration

**Date:** 2026-11-13  
**Disposition:** New source-grounded implementation and calibration signal  
**Repo:** https://github.com/dunetrace/dunetrace  
**Inspected revision:** [`00de23891082967fe338371fcd754636ad357caa`](https://github.com/dunetrace/dunetrace/commit/00de23891082967fe338371fcd754636ad357caa)

## Question

When can a runtime safely turn a decline in an agent's retrieval relevance scores
into an alert or intervention?

## Source observation

Dunetrace's `RAG_QUALITY_DEGRADATION` detector orders the scored, non-empty
retrievals from one index within a run, splits them into early and late halves,
and emits a shadow signal when the late average is more than 30% below the early
average. It requires at least three retrievals, ignores invalid scores and empty
results, does not pool different index names, and requires callers to convert raw
distance metrics into higher-is-better relevance scores.

Those implementation guards prevent several mechanical errors, but the
repository's own calibration shows that they do not establish detector precision.
The producer-authored stationary stress test draws independent benign scores with
no temporal degradation and invokes the real detector on 2,000 traces per cell.
At the default threshold, reported false-positive rates range from 17.2% to 29.8%
for uniform scores, 19.4% to 29.0% for low-centered `Beta(2,8)` scores, and 12.4%
to 28.0% for a 70/30 easy/hard query mixture as trace length varies from 3 to 10.
High-centered score distributions produce much lower rates. These are synthetic
Monte Carlo results, not estimates of production prevalence.

A separate 16-trace hand-labeled boundary corpus reports 4 true positives, 3
false positives, 1 false negative, and 8 true negatives. The false positives
include a legitimate query-intent change and benign mixes of easy and hard
queries; the missed case is a gradual decline below the default threshold. The
repository therefore keeps the detector in shadow mode and says real traffic
must be labeled by index, scorer, and query mix before promotion.

## Interpretation

**A relevance-score trend is a routing signal, not proof that retrieval quality
or answer quality degraded.** Even after separating index names, a later query
may simply be harder, ask for a different kind of evidence, or use a changed
scorer. Score-only telemetry cannot distinguish those cases from deterioration
of the retrieval system.

A reusable promotion contract for telemetry-derived agent alerts should include:

1. **Metric semantics:** record the index, scorer identity and version,
   higher-is-better conversion, query class, and score coverage. Missing or
   incomparable measurements should remain unknown rather than being coerced
   into a bad score.
2. **Shadow evidence:** retain detector outputs without alerting or blocking, and
   join each signal to a later human or outcome label sufficient to estimate both
   false positives and misses.
3. **Stratified calibration:** choose thresholds against the actual distribution
   and false-positive budget for each meaningful index/scorer/query stratum.
   Raising a minimum sample count or requiring recurrence does not by itself make
   a mis-specified score statistic valid.
4. **Promotion authority:** activate alerts or interventions only after a bounded
   review of labeled traffic, with rollback when the scorer, corpus, query mix, or
   instrumentation changes.
5. **Separate outcome checks:** verify retrieval usefulness or answer quality with
   task evidence rather than treating an internal relevance score as the final
   oracle.

Dunetrace also illustrates a useful transparency pattern: the calibration script
calls the production detector rather than reimplementing its formula, publishes
both misses and false alarms, distinguishes synthetic sensitivity from production
precision, and gives a sample-cost example for a false-positive target. Its report
calculates that, under an IID continuous-distribution assumption with zero observed
exceedances, at least 149 benign traces are needed to bound a fresh-draw exceedance
probability by 2% with 95% confidence. That example is explicitly not a guarantee
under dependence, distribution shift, ties, or post-selection tuning.

## Implementation boundaries worth preserving

The reviewed code carries an index name from `retrieval.called` into the matching
response when an integration such as LangChain names the retriever only at start,
and stringifies unexpected non-string names rather than crashing a grouping
operation. It rejects non-finite, negative, and boolean scores; numeric strings and
NumPy-like scalar values are accepted. Empty results are delegated to a separate
absolute failure detector instead of being counted as temporal decline.

The repository also separates detection from action. `RAG_QUALITY_DEGRADATION`
ships shadowed, while its configured future alert policy would require occurrence
in 3 of 10 runs. That recurrence rule can reduce notification volume, but it does
not fix confounding: a stable shift in query difficulty can recur too. Promotion
still needs labeled, distribution-specific evidence.

## Limits

- Scout inspected producer-authored source, tests, documentation, and calibration
  results statically. Scout did not run the detector, tests, replay system,
  calibration script, SDK, dashboard, or any retrieval workload.
- The stationary stress test uses selected synthetic IID distributions. It does
  not model correlated queries, changing corpora, scorer upgrades, score ties,
  production routing, or user behavior.
- The 16-case corpus is small and hand-labeled by the producer. Its precision and
  recall are boundary observations, not population estimates.
- Grouping by index name prevents direct cross-index pooling but does not prove
  that one name always maps to one scorer, corpus version, or query population.
- The detector observes top scores, not retrieved-document correctness, coverage,
  citation support, downstream answer quality, or task success.
- The inspected commit is a moving project revision. This review does not establish
  deployment safety or that every documented shadow and alert path behaves as
  intended.

## Primary inspected sources

- [Detector implementation](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/packages/sdk-py/dunetrace/detectors.py)
- [Detector tests and run-builder integration cases](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/packages/sdk-py/tests/test_rag_quality_degradation.py)
- [Synthetic sensitivity and sample-cost report](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/scripts/calibration/rag_quality_degradation_calibration.md)
- [Calibration script invoking the production detector](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/scripts/calibrate_rag_quality_degradation.py)
- [Run-state reconstruction and index-name handling](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/packages/sdk-py/dunetrace/run_builder.py)
- [Detector semantics and shadow-mode documentation](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/docs/detectors.md)
- [Replay modification and its detector-target boundary](https://github.com/dunetrace/dunetrace/blob/00de23891082967fe338371fcd754636ad357caa/services/api/api_svc/routers/replay.py)

## Discovery record

GitHub Repository Search API query: `topic:ai-agents pushed:>=2026-11-13 stars:>20`,
sorted by update time descending, 50 results requested. The API returned
`total_count: 1435` and `incomplete_results: false`. Repository contents were
inspected only after pinning the revision above.
