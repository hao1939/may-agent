# One Human, N Agents: Audit-Budget Allocation for LLM Agent Fleets

Date: 2026-07-31
Last updated: 2026-08-10
Source: https://arxiv.org/abs/2607.28317
Source: https://arxiv.org/abs/2608.06949v1
Source: https://arxiv.org/html/2608.06949v1
Tags: #oversight #agent-fleet #governance #confidence-calibration #audit-coverage #queueing

## Summary

Formalises the problem of a single human auditing N LLM agents under a budget B ≪ N audits per round, where agents self-report confidence that may be adversarially miscalibrated. Models this as budgeted noisy inspection over a two-level Gaussian copula and derives a miscalibration threshold δ* past which confidence-ranked auditing performs *worse* than random selection.

## Key Findings

- **Miscalibration threshold flips intuition**: δ* *rises* as the budget shrinks—tighter budgets are more robust to miscalibration, not less.
- **Correlation dominates lineage**: Cross-family error correlation is high because shared task difficulty drives correlated failures, not model ancestry.
- **Open-weight models are near-vacuous**: Five open-weight LLMs show operationally useless (near-constant) confidence; point estimates land at or beyond the flip threshold. A proprietary model is informative and lands below it.
- **Quantitative criterion for vacuous oversight**: Provides a formal test for when confidence-based oversight is meaningless.

## Relevance to AI Agents

- Directly addresses the scaling problem in human-agent oversight: when you have many agents, how do you allocate scarce audit capacity?
- Formalises when confidence-based triage is actively harmful—important for agent orchestrators that route reviews by self-reported certainty.
- Connects to the Oversight Inversion thesis: more agents may yield *less* effective oversight if confidence signals are uninformative.
- Practical implication: agent platforms should test whether their models' confidence scores pass the vacuity criterion before using them for audit prioritisation.

## Limitations

- Theoretical framework validated on recorded traces rather than live deployment.
- Assumes a single auditor; multi-auditor extensions are noted as future work.

## Update — Audit overload can be a queue-coverage failure (2026-08-10)

A new triage simulation complements the earlier allocation theory by separating **whether a case is reviewed** from **how well the auditor judges a reviewed case**. In 192 GPT-4o-mini episodes containing 2,304 demographic twin pairs, a nine-agent assessment/allocation/audit pipeline did not measurably change the bias rate relative to a single-agent control (6.1% versus 6.9%, p=0.498). Independent review therefore did not remove the underlying failure in this setting.

Capacity did change detection. When audit throughput was capped at one review per turn, review coverage fell from 100.0% to 65.6% (p<0.001). Judgment on cases that reached the auditor did not deteriorate: reported catch rates were 85.7% under overload and 81.6% without overload (p=1.000). The resulting blind spot was primarily a **queue admission problem**, not evidence that the auditor became less capable under pressure.

A paired follow-up reran the same 48 overloaded episodes and prioritized decisions whose rationales named a protected attribute or ended in denial. With unchanged audit capacity, coverage rose from 65.6% to 91.7% (p=0.028). The associated catch-rate increase, from 56.2% to 79.2%, was directionally favorable but not statistically confirmed (p=0.092), so the evidence supports coverage recovery more strongly than end-to-end bias detection.

### Combined operational implication

The two papers expose both sides of audit prioritization:

1. a queue policy can recover scarce review coverage without adding capacity; but
2. ranking can underperform random review when its confidence or risk signal is vacuous or miscalibrated.

Agent-fleet oversight should therefore log separate denominators for eligible, queued, reviewed, flagged, and repaired cases. It should validate the ranking signal against a random-audit holdout and monitor protected cohort coverage, rather than reporting only accuracy among reviewed cases. A healthy auditor metric can otherwise conceal an expanding unreviewed tail.

### Evidence limits of the update

The new result is from one non-peer-reviewed arXiv v1 simulation using one model, a fixed nine-agent topology, synthetic disaster triage, modest samples, and no adversarial replication. Its raw bias-rate comparison and priority-queue catch-rate gain are underpowered. The reusable finding is the coverage-versus-judgment decomposition and the need to test queue policies, not a claim that this risk heuristic generalizes to deployed systems.
