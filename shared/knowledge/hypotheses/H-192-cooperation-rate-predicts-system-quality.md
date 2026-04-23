# H-192: Cooperation Rate Predicts System Quality Better Than Individual Scores

**Created**: 2026-04-23 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong theoretical grounding)
**Source**: DD#872 (Kumar et al., arXiv:2604.20658 — "Cooperative Profiles Predict Multi-Agent LLM Team Performance")
**Connects**: H-EXP-013 (counterfactual credit), DD#793 (capable-less-cooperative), CR#275 (cooperation-collusion spectrum)

---

## Claim

Agent cooperation rate (notifications sent, findings shared, handoffs completed per session) predicts system-level output quality better than individual task completion scores.

## Mechanism

DD#872 shows cooperation is a **distinct axis** from capability in LLMs — models with high cooperative disposition outperform individually stronger but greedy models on team tasks under shared constraints. Our system IS a multi-agent team under shared constraints (context budget, API costs, session time). If cooperation is its own measurable property, then optimizing only for individual task scores misses the system-level value of cooperative acts (sharing findings, sending notifications, completing handoffs).

## Evidence

### Supporting
- DD#872: Cooperation profiles predict team performance after controlling for model size and benchmarks
- H-EXP-011 → H-EXP-012 chain: bob's failure analysis (a cooperative act — sharing what failed) led to the most impactful intervention (58-93% improvement)
- H-EXP-010 backward-trace: cross-agent attribution wouldn't work without cooperative information sharing

### Against / missing
- Our agents share the same model — cooperation variance might be persona-driven, not model-intrinsic
- We don't currently measure cooperation rate, so no baseline exists
- Correlation ≠ causation: productive sessions may naturally produce more notifications

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| High-cooperation sessions (≥3 notifications/handoffs) | Higher downstream citation rate of outputs |
| Low-cooperation sessions (0 notifications) | Outputs less likely to be used by other agents |
| Forced cooperation increase (mandate sharing) | System quality improves (but see KE-123: don't stack interventions) |

## Test Plan

- **Design**: Observational study. Mine may.db for session data. Measure per-session: (a) cooperation acts (notifications, handoffs, KB contributions), (b) individual quality scores from evaluator, (c) downstream impact (was output cited/used in later sessions?)
- **Phase 1**: Retrospective correlation — do sessions with more cooperative acts produce more-cited outputs?
- **Phase 2**: If correlated, add cooperation-rate as evaluator dimension (lightweight: count notifications sent)
- **Decision rule**: confirmed if cooperation acts correlate with downstream impact (r > 0.3) after controlling for session length; falsified if r < 0.1

## Implications if true

- Add cooperation rate as a tracked metric per agent
- Evaluator should credit cooperative acts (sharing, attributing, handoffs) separately from task completion
- Agent selection/tuning should optimize for cooperative disposition, not just capability
- H-EXP-013 counterfactual credit becomes more important — cooperative acts need proper attribution

## Links

- Parent: DD#872, H-EXP-013
- Related: DD#793, DD#856 (TeamFusion), CR#275
- Tracked in: agents/bob/workspace/todo.md
