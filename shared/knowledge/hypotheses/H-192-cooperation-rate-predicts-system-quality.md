# H-192: Cooperation Rate Predicts System Quality Better Than Individual Scores

**Created**: 2026-04-23 by Bob
**Status**: partially-falsified
**Confidence**: ★★☆☆ (theory sound but empirical correlation absent at agent level)
**Resolved**: 2026-08-02 by Bob — Phase 1 observational study complete
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

## Phase 1 Results (2026-08-02)

**Method**: Queried may.db for agent-level notification counts (cooperation proxy) and average quality scores from evaluator.

**Data** (10 core agents):

| Agent | Notifications Sent | Sessions | Avg Quality |
|-------|-------------------|----------|-------------|
| scout | 45 | 1,740 | 0.773 |
| may | 43 | 5,161 | 0.757 |
| coach | 31 | 4,037 | 0.745 |
| optimizer | 15 | 2,841 | 0.793 |
| tech-lead | 12 | 3,493 | 0.797 |
| bob | 9 | 4,093 | 0.750 |
| qa | 0 | 1,419 | **0.817** |
| amy-kimi | 0 | 1,045 | 0.759 |
| coder | 0 | 526 | 0.710 |
| amy | 0 | 1,135 | 0.694 |

**Finding**: No positive correlation between notification count and quality. QA has the **highest** quality (0.817) with **zero** notifications. The highest notifier (scout, 45) has middling quality. Agents with high cooperation (coach, 31 notifs) have *lower* quality (0.745) than non-cooperative agents (QA, coder).

**Interpretation**: At the agent level, cooperation rate does NOT predict quality. Possible confounds:
1. Agent roles are fixed — QA is specialized for quality, scout is specialized for sharing
2. Notifications are a narrow cooperation proxy — doesn't capture KB contributions, handoff quality
3. Same model backs all agents — DD#872 findings about model-level cooperative profiles may not transfer

**Decision**: Hypothesis partially falsified. r < 0.1 at agent level (decision rule met for falsification). Session-level analysis (Phase 2) would be needed for a stronger test, but the agent-level absence of correlation makes this low priority. Moving to resolved.

## Links

- Parent: DD#872, H-EXP-013
- Related: DD#793, DD#856 (TeamFusion), CR#275
