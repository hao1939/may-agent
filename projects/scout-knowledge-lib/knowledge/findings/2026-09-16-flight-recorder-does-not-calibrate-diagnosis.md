<ai_context>
This finding reviews a pinned GitHub flight-recorder implementation for AI agents. It distinguishes trace capture, detector coverage, external diagnostic accuracy, detector-relative ablation, and tool-step replay; repository tests and published repository artifacts are implementation evidence, not independent validation.
</ai_context>

# A flight recorder does not by itself calibrate the diagnosis

**Date:** 2026-09-16  
**Source:** GitHub  
**Repo:** [B1ueMu3ic4m/approximately](https://github.com/B1ueMu3ic4m/approximately)  
**Pinned revision:** [`929499f6ae46a8ce12fbf2e559dcbf0d765de7c8`](https://github.com/B1ueMu3ic4m/approximately/commit/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8)

## Finding

Approximately is a useful compact example of why agent observability needs a layered assurance vocabulary. Its pinned implementation records structured steps, applies rules for all 14 MAST failure-mode identifiers, optionally adds an LLM judge, generates attributed reports, re-executes recorded tool steps, and can hash or HMAC the trace ([overview](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/README.md#L124-L155), [attribution implementation](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/src/approximately/attributor.py)). Those are distinct capabilities, however, and none automatically validates the others.

The repository's own real-data leaderboard is especially informative. “14/14 rule coverage” means that the registry contains a detector for each taxonomy identifier; a repository test checks `len(ALL_DETECTORS) == 14` and exercises synthetic traces with hand-constructed cues ([coverage test](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/tests/test_full_mast_coverage.py)). It does **not** mean that the rules accurately classify all 14 modes on external trajectories. The repository's MAST conversion retained only 13 single-label records after excluding 15 multi-label, 1,841 without a covered mode, 87 unannotated, four too-short, and three unreadable records. Its shipped rules-only v6 reports accuracy 0.08 and macro-F1 0.08 on those 13, with one hit among two FM-2.1 examples and no hits in the other represented gold modes ([leaderboard and accounting](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/docs/LEADERBOARD.md)). The sample is too small and selected to estimate general performance, but it is enough to disprove an interpretation of detector-name coverage as demonstrated diagnostic coverage.

The benchmark also localizes the gap: structural cues such as literal repetition are amenable to rules, while outcome-level judgments are not reducible to the presence of verification language. All six retained FM-3.2 examples discussed both verification and execution; the annotation turned on whether the outcome was actually verified, so the repository deliberately deferred that semantic distinction rather than fit a regex to six examples. This is good evidentiary discipline. A trace schema can make evidence available without making its interpretation correct.

Two further labels need similarly narrow readings:

- **“Counterfactual RCA” is detector-relative ablation.** The implementation removes one recorded step, reruns `attribute()` on the edited trace, and calls the step a root cause when the same detector mode disappears. It does not rerun the agent or environment under an intervention, so it establishes sensitivity of the attribution function to a trace element, not that removing the real action would have prevented the operational failure ([counterfactual implementation](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/src/approximately/counterfactual.py)).
- **“Replay” is tool-step re-execution, not full trajectory replay.** By default it calls a supplied executor for each recorded tool call and compares textual results with `SequenceMatcher` at a 0.85 threshold. If the original step had an error, any new exception at that step makes the failure “reproduced”; exception identity and environment state are not required to match. This is a useful regression probe, but not deterministic restoration of model state, external services, time, credentials, or side effects ([replayer](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/src/approximately/replayer.py#L91-L166)).

## Design implication

An agent incident report should expose separate fields for at least:

- `trace_integrity`: whether the presented bytes have remained unchanged under the stated key and trust boundary;
- `detector_applicability`: which modes have executable rules and what trace features they require;
- `diagnostic_calibration`: held-out per-mode precision, recall, abstention, sample count, and selection rules;
- `ablation_scope`: whether an intervention reran only the classifier, the tool, or the complete environment and agent;
- `replay_fidelity`: which state was restored, which effects were suppressed or sandboxed, and what constitutes a match;
- `outcome_verification`: independent evidence that the proposed fix corrected the original task-level failure.

A strong flight recorder improves postmortem legibility even when diagnosis remains weak. The recorder's value should not be discounted; it should be reported independently so “we captured enough to investigate,” “a heuristic labeled the trace,” and “the fix was causally validated” cannot collapse into one assurance claim.

## Coverage and limits

Reviewed the complete pinned tree listing plus the README, security model, leaderboard, attribution, detector, counterfactual, replay, trace, and selected attribution/coverage/counterfactual tests. All cited files were retrieved from the pinned revision through read-only GitHub endpoints. This was static review: no package installation, test execution, independent regeneration of the MAST conversion, inspection of all 516 KB of converted benchmark records, or validation on a live agent deployment. The repository's leaderboard is self-published and the retained external sample is only 13 single-label records. Its security document also correctly limits an unkeyed hash chain to accidental or lazy tampering and notes that HMAC assurance depends on secret custody ([security model](https://github.com/B1ueMu3ic4m/approximately/blob/929499f6ae46a8ce12fbf2e559dcbf0d765de7c8/docs/SECURITY.md)); this review does not independently assess that implementation.
