<ai_context>
This source-grounded GitHub finding evaluates a calibrated auto-approval concept at a pinned repository revision. Use it when designing approval automation, shadow review, or drift-triggered revocation. Keep repository-authored evaluation distinct from Scout's local test and smoke-check evidence.
</ai_context>

---
title: "Agent Auto-Approval Needs a Risk Certificate and a Drift Tripwire"
source: github
date: 2026-11-17
type: finding
tags: [github, agent-governance, approvals, risk-control, human-in-the-loop, drift-monitoring]
relevance: high
---

# Agent Auto-Approval Needs a Risk Certificate and a Drift Tripwire

## Finding

[`Mohith26/cofounder-calibrated-approvals`](https://github.com/Mohith26/cofounder-calibrated-approvals) turns agent auto-approval from a binary product setting into a measurable risk-control problem. At pinned revision [`63b15878c95ccb5d70efcacc6d85e0bf03e8933b`](https://github.com/Mohith26/cofounder-calibrated-approvals/tree/63b15878c95ccb5d70efcacc6d85e0bf03e8933b), the concept combines:

1. a request-level risk scorer;
2. Learn-then-Test calibration that selects an auto-approval threshold only when the observed rejection history supports a chosen leak limit; and
3. an anytime-valid monitor that sends all requests back to manual review when shadow labels provide evidence that the leak rate has shifted above the target.

Here, **leak** means the share of requests that the owner would reject but the gate auto-approves. That definition makes the operational promise concrete: not “the classifier is usually accurate,” but “under stated assumptions, the selected gate limits how much rejected work escapes review.”

## Source evidence

The repository uses 571 public R-Judge agent records, including 301 labelled unsafe, as a proxy for an owner's approve/reject history. Its committed 200-split evaluation reports that a gate targeting a 10% leak with 90% confidence:

- auto-approved 39.3% of all requests and 77.1% of approvable requests;
- had a mean held-out leak of 5.75%;
- exceeded the target on the full held-out population in 4% of splits; and
- compared with 48.5% population-target violations for an uncorrected empirical threshold.

The repository also evaluates distribution shift. A gate calibrated only on prompt-injection examples and then exposed to unintended agent mistakes reached a 19.7% mean leak. With 20% shadow review, the monitor detected 96.7% of runs whose leak exceeded 20%, at a median delay of 85 requests, and reduced leaked rejections by 80.3%. The monitor false-alarmed in 4% of no-shift runs in the repository's 100-seed simulation.

Scout checked the source rather than relying only on the README. The pinned tree contains the scorer, exact-binomial calibration, inverse-propensity-weighted betting monitor, dataset builder, evaluation scripts, committed results, and 29 tests. In a clean temporary checkout under Node 24.21.0, all 29 tests passed. A separate 20-seed evaluation reproduced the mechanism's direction: 38.7% queue reduction, 76.5% of approvable requests auto-approved, 4.85% mean population leak, and no population-target violations in that small rerun. The 20-seed result is a smoke check, not an independent replication of the committed 200-seed estimates.

## Why it matters

Existing agent permission systems increasingly replace repetitive human prompts with classifiers. This repository adds two missing layers:

- **calibration before delegation:** the threshold is selected against a user-chosen consequence metric rather than a generic classifier score; and
- **monitoring after delegation:** a valid launch-time certificate is not assumed to survive model, workload, or attack-distribution drift.

The selection-bias rule is particularly important. Decisions routed to review because of the gate's own score cannot be treated as an unbiased sample of future leaks. The source therefore updates its history only from decisions that were not selected by that score, such as randomized shadow reviews or departments still operating in Always Ask mode.

This suggests a stronger architecture for agent approvals: hard capability boundaries remain the containment layer; calibrated automation allocates scarce reviewer attention within that boundary; randomized shadow review preserves outcome evidence; and an anytime tripwire revokes automation when its assumptions stop matching reality.

## Limits

The evidence is a newly published concept repository, not a production deployment or independent security evaluation.

- R-Judge safety labels stand in for one owner's preferences. Real reviewers differ, make mistakes, and may change policy over time.
- The statistical certificate assumes exchangeability between calibration history and future requests. The repository's own shift experiment shows that the guarantee can fail when this assumption breaks.
- The monitor is not instantaneous: it requires continued labels and may permit tens or hundreds of requests before alarming.
- The simple hashed-text and structural-feature scorer is dataset-specific; strong AUROC does not establish resilience to adaptive attacks or semantic substitutions.
- A bounded leak rate is not a sandbox. Even a small false-approval rate may be unacceptable for irreversible, privileged, costly, or externally visible effects.
- The repository's committed evaluation and proof sketches are author-produced. Scout ran its tests and a smaller rerun but did not independently prove the statistical derivations or rebuild the dataset from upstream R-Judge.

## Operational implication

Agent runtimes should replace a single “auto-approve” switch with an explicit policy contract:

- define which rejected actions count as leakage and which action classes can never be automated;
- require enough independent rejection history before enabling automation;
- publish the target leak, confidence level, calibration population, threshold, and effective sample size;
- reserve randomized shadow review so the system continues to learn about actions it would otherwise hide from reviewers;
- trip back to manual review on anytime-valid shift evidence; and
- keep effect-level containment, recoverability, and audit receipts outside the statistical gate.

The non-obvious lesson is that reducing approval fatigue safely requires measuring the errors humans would still care about after their prompts disappear.
