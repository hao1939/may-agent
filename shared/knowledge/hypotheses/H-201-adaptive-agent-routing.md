# H-201: Adaptive Agent Routing on Failure Recovers 40%+ of Failures

**Created**: 2026-06-24 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong prior from H-EXP-029)
**Source**: H-EXP-029 (role-context lever) — validated that role selection > role context > skills
**Connects**: H-EXP-029, H-EXP-027, H-EXP-024, EXP-224/225/226/227/228

---

## Claim

When a task fails with one agent, automatically re-routing to a different agent (based on the role hierarchy from H-EXP-029) will recover 40%+ of failures without any skill or context changes.

## Mechanism

H-EXP-029 showed that coder scored 0% on a judgment task where tech-lead scored 100% on the identical scenario. The role's system prompt and training distribution determine what kinds of reasoning the agent applies. Many failures aren't about missing knowledge — they're about mismatched agent-task fit. A routing layer that detects failure patterns and retries with a better-matched agent exploits the cheapest, most effective lever in our hierarchy.

## Evidence

### Supporting
- H-EXP-029: coder 0% → tech-lead 100% on same security scenario (role switch only)
- H-EXP-027: structural interventions >> text interventions (validated)
- 5/5 skill-based coder interventions failed (EXP-224/225/226/227/228) — the agent was wrong, not underinformed
- EXP-231: coaching notifications hit saturation — more instructions don't help

### Literature Support (added by scout 2026-04-26)
- **REDEREF (arXiv:2603.13256, DD#415)**: Training-free Thompson Sampling router for multi-agent LLM systems. Belief-guided delegation + reflection-driven re-routing achieves 28% token reduction, 17% fewer agent calls, 19% faster time-to-success vs random routing at matched 96.5% success rate. Key: models agent *marginal contribution probability*, not solve probability — directly validates H-201's "agent-task fit" framing. Cooldown mechanism prevents exploitation loops (relevant to retry cost concern).
- **BiRouter (arXiv:2512.00740, DD#775, AAAI 2026)**: Decentralized bi-criteria routing using ImpScore (strategic value) × GapScore (context continuity). Shows routing works even without central orchestrator. Reputation mechanism handles unreliable agents — relevant to our agent reliability variance.
- **AEL (arXiv:2604.21725, DD#877)**: "Less is more" finding — memory + reflection alone gives 58% improvement, but adding routing/selection complexity *degrades* performance. **Caution for H-201**: simple retry-with-different-agent may outperform a sophisticated routing layer. Keep the mechanism minimal.

### Against / missing
- No data on what % of all failures are agent-task mismatches (could be <10%)
- Retry cost: re-running with a different agent doubles compute — but REDEREF shows belief-guided routing *reduces* total cost vs naive retry
- May not generalize beyond the security scenario tested in H-EXP-029
- Evaluator dormant since April — can't measure current failure rates by agent
- AEL's "less is more" warns against over-engineering the routing layer

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Task fails with coder, re-routed to tech-lead | 40%+ recovery on judgment/security tasks |
| Task fails with tech-lead, re-routed to coder | Low recovery (<10%) — coder is strictly weaker on judgment |
| Routing on pure implementation tasks | No benefit — agent fit is already correct |
| Routing cost vs skill-tuning cost | Routing cheaper per recovered failure (1 retry vs N skill iterations) |

## Test Plan

- **Design**: Collect last 20 task failures from evaluator logs. Classify each as (a) agent-task mismatch, (b) missing knowledge, (c) environment issue. For type (a), replay with alternative agent.
- **Scenario**: Historical failures from `.state/evaluations/` or gym replay
- **Decision rule**: Confirmed if ≥40% of replayed type-(a) failures succeed with different agent. Falsified if <20% recovery or if type-(a) is <15% of all failures.
- **Blocker**: Requires evaluator to resume producing evaluations, OR manual classification of recent session transcripts.

## Implications if true

- Build a retry-with-routing layer into the orchestrator (may → tech-lead fallback, coder → tech-lead fallback)
- Prioritize agent selection in task dispatch over skill customization
- Reduce investment in per-agent skill tuning (diminishing returns confirmed by 5 failed experiments)
- Design an agent-task affinity matrix based on failure data

## Links

- Parent: H-EXP-029 (role-context lever)
- Related: H-EXP-027 (environmental constraints), H-EXP-024 (selective skill loading)
- Tracked in: .state/hypotheses/
