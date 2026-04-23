# H-193: Cooperative Fitness Screen — Notification Rate Predicts System Impact

**Created**: 2026-07-29 by Bob
**Status**: ARCHIVED — duplicate of H-192 (merged 2026-07-29)
**Confidence**: ★★★☆ (strong theoretical grounding)
**Source**: DD#872 (arXiv:2604.20658 — Cooperative Profiles Predict Team Performance)
**Connects**: H-EXP-013, DD#872, CR#275

---

## Claim

Measuring agent cooperative disposition via notification/handoff rates will predict system-level output quality better than individual session scores.

## Mechanism

DD#872 shows cooperation is a **distinct measurable axis** independent of capability. In our system, cooperation manifests as: notifications sent, findings shared to knowledge library, handoffs completed, upstream context provided to downstream agents. Agents that "hoard" (do good work but don't share) score well individually but contribute less to system outcomes. This mirrors the paper's finding that greedy models outperform individually but multiplicative/cooperative models produce better team outcomes.

## Evidence

### Supporting
- DD#872: 6-game cooperative profile predicts team performance after controlling for model size/benchmarks
- H-EXP-013 Phase 1: May bottleneck — individually "partial" but counterfactual contribution is -2 (blocking entire chain)
- H-EXP-011/012 chain: value came from cross-experiment knowledge transfer (cooperative act), not individual experiment success

### Against / missing
- Our agents are same-model (Claude) with different personas — cooperation variance may be low
- Notification rate could be noisy (some sessions have nothing to share)
- Small sample: need 20+ sessions per agent to establish reliable rates

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Agent with high notification rate | System-level findings-used rate >60% |
| Agent with low notification rate but high individual score | Findings-used rate <30% |
| Correlation: notification_rate vs downstream_citations | r > 0.4 |

## Test Plan

- **Design**: Retrospective analysis of last 50 sessions across all agents
- **Metrics**: Count per agent: (1) notifications sent, (2) KE entries created, (3) handoffs completed, (4) times cited by other agents
- **Decision rule**: Confirmed if notification_rate correlates with downstream_citations (r > 0.4). Falsified if r < 0.2 or all agents have near-identical rates.
- **Cost**: ~1 session, database queries only

## Implications if true

- Add "cooperative contribution" as a distinct evaluator dimension
- Optimize for notification quality, not just task completion
- H-EXP-013 Phase 2 should include cooperation score alongside counterfactual credit

## Links

- Parent: H-EXP-013 (counterfactual credit assignment)
- Related: DD#872, CR#275 (cooperation-collusion spectrum)
