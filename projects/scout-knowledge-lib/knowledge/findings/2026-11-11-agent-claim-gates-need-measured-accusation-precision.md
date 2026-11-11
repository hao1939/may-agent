<ai_context>
summary: "A repository's self-audit shows that diff-grounded agent-claim gates can produce precise-looking but mostly false accusations; blocking authority should follow external accusation-precision measurement, explicit unknowns, and fail-safe detector retirement."
triggers: ["agent PR summary verification", "diff gate", "claim checker precision", "false accusations", "evidence gate", "agent review integrity"]
last_updated: "2026-11-11"
source_basis: "Static inspection of fathom-lab/styxx at pinned commit e9fa2ead67ca6505029b314aee0c5cdabd88be83: complete non-truncated 6,874-entry tree, README, EXTERNAL-1 result and correction, EXTERNAL-2 census, committed summary and taxonomy receipts, current diff-gate implementation, and selected false-accusation tests. Scout did not install or run Styxx, reproduce the AIDev analysis or panels, inspect the complete corpus, or execute tests or the GitHub Action."
</ai_context>

# Agent claim gates need measured accusation precision

**Date:** 2026-11-11  
**Disposition:** new knowledge  
**Coverage:** static source and committed-result inspection at one pinned revision

**Repo:** https://github.com/fathom-lab/styxx  
**Pinned revision:** https://github.com/fathom-lab/styxx/commit/e9fa2ead67ca6505029b314aee0c5cdabd88be83

## Observation

Styxx includes a deterministic diff gate that reads claims in pull-request prose and compares them with changed files and added lines. Its repository is unusually useful because it publishes negative measurements of its own instrument rather than treating a plausible rule or passing unit test as sufficient evidence for blocking changes.

The committed EXTERNAL-1 study ran the gate over 71,016 eligible agent-authored pull requests from the AIDev corpus. It found checkable claims in 15,965 pull requests, then sent 100 sampled accusations plus 30 decoys to a three-seat panel. The panel upheld 23 of the 100 accusations, for observed accusation precision of 0.23 against a preregistered 0.95 floor. The repository consequently withholds the path-claim accusation and makes the GitHub Action report-only by default; blocking requires an explicit `soft-fail: "false"` setting.

A later mechanical census is useful for showing how a detector can be wrong before any semantic adjudication:

- 168 of 184 `tests_added` accusations and 59 of 65 `symbol_added` accusations occurred in diffs with no Python file even though those detectors counted added Python `def` lines.
- 322 of 341 `only_touches` accusations captured an English word such as `the`, `with`, or `that` as the supposed path prefix.
- The authors classified 549 of 665 remaining accusations, 82.6%, as unsupported by construction. This census was not preregistered and did not adjudicate the other 116 accusations, so it is diagnostic evidence rather than a corrected precision estimate.
- The currently inspected source retains an explicit `WITHHOLD_PATH_ACCUSATION = True` flag and false-accusation regression tests, keeping retired accusations measurable without allowing them to block users.

The measurement process also failed in a revealing way. EXTERNAL-1 initially blamed missing path-suffix matching, but a same-day correction found that matching already existed and that the benchmark harness had collapsed per-commit file statuses incorrectly. That defect made some genuinely added files appear merely modified. The measured end-to-end precision remained 0.23, but the causal story changed after the authors inspected the instrument's recorded reasons rather than the adjudicators' prose summary.

## Interpretation

Diff grounding is a valuable evidence source, but it does not make a claim detector authoritative. A rule can consult committed bytes and still bind the wrong verb, object, programming language, path, scope, negation, or aggregation level. Review integrity therefore needs two distinct questions:

1. **Is the proposed claim tied to an inspectable artifact?** This determines whether checking is possible.
2. **Has this checker earned the authority to accuse or block?** This requires measured accusation precision on representative, independently adjudicated data.

A safe admission ladder is:

1. extract claims and preserve the exact text, artifact revision, detector version, and reason;
2. return `UNCHECKABLE` when the detector's language, file type, scope, or evidence surface does not cover the claim;
3. run in report-only mode until each accusation class has a representative precision estimate;
4. measure the complete reconstruction and judging harness, not only the detector in isolation;
5. pin known false accusations as regression cases and keep retired logic behind explicit, non-accusing flags when counterfactual measurement remains useful;
6. grant blocking authority per accusation class, not to the tool as a whole; and
7. preserve corrections that distinguish a detector failure from a harness-created false account of the artifact.

For agent systems, this means evidence gates should not collapse "grounded in a diff," "deterministically reproducible," and "reliably correct" into one status. A false accusation can stop valid work, distort agent-quality metrics, and teach users to ignore real warnings. Report-only output with explicit unknowns is safer than a high-confidence-looking blocker whose positive predictive value has not been measured.

## Limitations

All measurements and receipts are producer-authored. Scout did not download the AIDev corpus, rerun the 71,016-pull-request analysis, validate corpus reconstruction, inspect all adjudication packets, reproduce panel blinding or agreement, execute the current detector, run its tests, or compare current revision 8.0.0 behavior with the older measured wheels. EXTERNAL-1 mixes detector and harness behavior in its end-to-end precision figure, and the same-day correction shows why causal attribution needs care. EXTERNAL-2 is a mechanical census without human adjudication. The inspected evidence supports a deployment and evaluation pattern for claim gates; it does not establish Styxx's current recall, current overall precision, or fitness for blocking arbitrary repositories.

## Inspected source

- [README and current deployment posture](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/README.md)
- [EXTERNAL-1 result](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/papers/closed-model-frontier/RESULT_external1_the_gate_fails_in_the_wild_2026_08_31.md)
- [EXTERNAL-1 same-day correction](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/papers/closed-model-frontier/CORRECTION_external1_cause_2026_08_31.md)
- [EXTERNAL-1 committed summary](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/papers/closed-model-frontier/external1_summary.json)
- [EXTERNAL-1 failure taxonomy](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/papers/closed-model-frontier/external1_failure_taxonomy.json)
- [EXTERNAL-2 accusation census](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/papers/closed-model-frontier/RESULT_external2_live_accusations_2026_09_16.md)
- [Current diff-gate implementation](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/styxx/diffgate.py)
- [False-accusation regression tests](https://github.com/fathom-lab/styxx/blob/e9fa2ead67ca6505029b314aee0c5cdabd88be83/tests/test_diffgate_false_accusations.py)
