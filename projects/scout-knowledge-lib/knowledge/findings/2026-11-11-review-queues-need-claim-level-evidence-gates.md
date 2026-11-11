<ai_context>
summary: "Open-ClinAgent's pinned prototype decomposes a draft report into claims, links each claim to current, prior, report, or structured evidence, and routes missing or conflicting support to an explicit human-review state before later approval and filing transitions. The reusable pattern is that a review queue should expose claim-level verification and stop conditions, not merely mark a whole artifact as awaiting review."
triggers: ["claim-level evidence", "human review queue", "review-ready agent output", "stop conditions", "artifact approval", "Open-ClinAgent", "ClinicalClaw"]
source_basis: "Static inspection of lanqz7766/Open-ClinAgent at commit 4319c854b6aeb883faa410a6d7b6e618f497d68c: complete non-truncated repository tree, README, neuro evidence-review implementation, platform task-transition implementation, workflow specification, and selected producer-authored tests. Scout did not run the software or tests and did not validate clinical correctness, security, or deployment behavior."
last_updated: "2026-11-11"
</ai_context>

# Review queues need claim-level evidence gates

**Date observed:** 2026-11-11  
**Disposition:** New source-grounded finding  
**Coverage:** Public GitHub repository pinned to commit `4319c854b6aeb883faa410a6d7b6e618f497d68c`; complete 631-entry tree; selected implementation, workflow, documentation, and producer-authored tests read statically.

## Sources

- **Repo:** https://github.com/lanqz7766/Open-ClinAgent
- **Pinned revision:** https://github.com/lanqz7766/Open-ClinAgent/commit/4319c854b6aeb883faa410a6d7b6e618f497d68c
- **Evidence-review implementation:** https://github.com/lanqz7766/Open-ClinAgent/blob/4319c854b6aeb883faa410a6d7b6e618f497d68c/src/clinagent/families/neuro/evidence_review.py
- **Review transition implementation:** https://github.com/lanqz7766/Open-ClinAgent/blob/4319c854b6aeb883faa410a6d7b6e618f497d68c/src/clinagent/platform/execution.py
- **Producer-authored evidence-review tests:** https://github.com/lanqz7766/Open-ClinAgent/blob/4319c854b6aeb883faa410a6d7b6e618f497d68c/tests/test_clinicalclaw_neuro_evidence_review.py
- **Producer-authored review-queue tests:** https://github.com/lanqz7766/Open-ClinAgent/blob/4319c854b6aeb883faa410a6d7b6e618f497d68c/tests/test_clinicalclaw_review_queue.py

## Source observation

Open-ClinAgent describes itself as a research-only clinical-agent prototype whose report drafts require qualified human review. The more useful implementation detail is that review is not represented only as a final button or one artifact-wide status.

Its neuro evidence-review module:

1. splits a draft report into individual claims;
2. classifies claims as findings, comparisons, or uncertainties;
3. links them to typed evidence references from the current study, a prior study, a prior report, or structured fields;
4. marks each claim `supported`, `conflicted`, or `missing_evidence`;
5. creates explicit stop conditions for absent priors, missing required sequences, unsupported claims, or conflicts between the narrative and a structured longitudinal comparison; and
6. sets the workflow to `needs_human_review` when any stop condition exists, otherwise `ready_for_review`.

The platform layer separately models task transitions. Its permitted path includes `running` to `in_review`, then `in_review` to `approved` or `rejected`; filing is a later transition. Producer-authored tests assert that approving a task also marks its artifact approved, filing marks the artifact exported, and attempting to file a rejected task raises an invalid-transition error.

A selected evidence-review test supplies a two-sentence draft where one claim has support and another lacks direct evidence. It expects two extracted claims, at least one supported claim, at least one missing-evidence claim, a `claim_missing_evidence` stop condition, and the overall workflow state `needs_human_review`. This is static, producer-authored evidence of the intended control semantics, not an independently run result.

## Reusable architecture signal

A human-review queue becomes substantially more useful when it preserves the reason for review at the smallest decision-bearing unit:

- **Artifact status** answers where the output is in the lifecycle.
- **Claim status** answers which assertions are supported, conflicted, or missing evidence.
- **Evidence references** answer what observation or structured field supports each assertion.
- **Stop conditions** answer what is missing and what the reviewer must resolve.
- **Transition rules** prevent review, approval, rejection, and external filing from collapsing into one ambiguous completion state.

For agent systems outside medicine, the same shape can apply to reports, code reviews, research summaries, deployment plans, or operational recommendations. A queue item should carry a set of reviewable assertions and their bound evidence, while unsupported or contradictory assertions remain explicit blockers. “Human reviewed” is then a lifecycle receipt layered over evidence receipts rather than a substitute for them.

This also clarifies a useful separation for May-like control planes: execution traces describe what an agent did, while claim-evidence records describe why a result should be accepted. Both can be retained, but a successful tool trajectory should not automatically upgrade unsupported result claims.

## Limits

- Scout inspected source and tests statically and did not install dependencies, run the test suite, execute workflows, or reproduce the claimed benchmark.
- The evidence verifier is a prototype based partly on sentence splitting, keyword/stem matching, simple evidence-text matching, and fixed numeric thresholds. It does not establish semantic entailment, clinical validity, or reliable conflict detection.
- Producer-authored tests show intended behavior for selected fixtures, not independent performance, recall, calibration, robustness, or safety.
- The repository explicitly states that it is research-only and not a medical device. This finding extracts a software-control pattern and makes no clinical-use recommendation.
- The inspected review transitions do not by themselves establish authenticated reviewer identity, authorization completeness, tamper resistance, audit-log integrity, or exactly-once external filing.
- The public repository was created the day of observation and had one GitHub star during discovery; maturity, maintenance, adoption, and production reliability are unknown.
