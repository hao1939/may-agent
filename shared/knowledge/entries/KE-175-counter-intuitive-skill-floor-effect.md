# KE-175: Counter-Intuitive Skills Fail at Universal Floors — Skill Effectiveness Requires Baseline Variance

**Source**: EXP-153 (54 trials: 24 escalation-impossible-task + 30 contradictory-requirements-ext-3unrelated)  
**Confidence**: High (primary scenario: exact zero across both arms; secondary: non-significant at n=30)  
**Created**: 2026-04-13  

---

## Finding

Skills targeting counter-intuitive behaviors do **not** produce measurable performance gains when the target scenario is a universal floor (0% baseline). Even though the 0% baseline seemingly creates maximum room for improvement, the scenario's difficulty overwhelms any skill effect. The skill text is inert — agents fail before reaching the decision point where the skill would apply.

### Primary Result: Escalation Skill on Impossible Task

| Condition | N | Pass Rate |
|-----------|---|-----------|
| Treatment (escalation skill) | 12 | 0.0% |
| Control (no skill) | 12 | 0.0% |

**Δ = 0.0pp** — Complete floor effect. The escalation skill provided zero benefit.

### Secondary Result: Transfer to Contradictory Requirements

| Condition | N | Pass Rate |
|-----------|---|-----------|
| Treatment (escalation skill) | 15 | 40.0% |
| Control (no skill) | 15 | 26.7% |

**Δ = +13.3pp** — Not statistically significant (χ² = 0.60, p > 0.4). Suggestive but inconclusive.

## Mechanism

Two complementary explanations for why the escalation skill failed:

1. **Judgment skill, not process skill**: Escalation requires *recognizing* an impossible situation — a judgment call. Per KE-021, judgment skills are the weakest skill type. The agent must first realize the task is impossible, and only then can the skill's "report blocked" instruction apply. A passive text file cannot teach novel pattern recognition.

2. **Passive injection fails for novel judgment**: Per KE-011, knowledge files are passive — agents skip them in oneshot mode. For natural behaviors this doesn't matter (the agent does them anyway, per KE-170). For counter-intuitive behaviors, the skill *needs* to override the default but can't because the agent never consults it at the critical moment. The agent is deep in problem-solving mode and doesn't pause to check whether it should escalate.

## Updated Model: The Skill Effectiveness Window

Combining KE-170 (ceiling) and KE-175 (floor), skill effectiveness requires scenarios with **20–60% baseline pass rates**:

```
Baseline    Effect      Reason
─────────────────────────────────────────────────────
0-15%       None        Floor — task overwhelms skill (KE-175)
15-25%      Uncertain   Possible weak effect, needs large N
25-60%      Possible    Sweet spot — variance exists, skill can be marginal factor
60-85%      Weak        Approaching ceiling — model mostly succeeds anyway
85-100%     None        Ceiling — skill is redundant (KE-170)
```

The +13.3pp secondary signal on contradictory-requirements (26.7% baseline) falls in the "possible" band, consistent with this model. It's non-significant at n=15, but the direction is right.

## The Counter-Intuitive Skill Hypothesis Is Not Dead — It's Narrowed

EXP-153 does NOT prove that counter-intuitive skills are worthless. It proves that:
- Skills cannot rescue scenarios where the base model universally fails (floors)
- The skill must target a scenario where agents *sometimes* reach the decision point

A counter-intuitive skill tested on a 30-50% baseline scenario — where agents sometimes succeed and sometimes don't — might still show the strong effect H-153 predicted. The escalation skill was simply tested on the wrong scenario.

## Implications

1. **Scenario selection is more critical than skill design**: Even a well-designed process skill is inert on a floor scenario. Before investing in skill creation, confirm the target scenario baseline is in the 25-60% range.
2. **Judgment skills need workflow enforcement, not text**: Per KE-021, process skills > knowledge > judgment. Escalation is fundamentally a judgment task. To improve escalation behavior, use workflow gates (active enforcement) rather than skills (passive advice).
3. **Transfer effects worth investigating**: The +13.3pp on the unrelated scenario, while non-significant, suggests skills may have diffuse effects across scenarios. An escalation skill could subtly shift agent behavior even on tasks that don't require escalation. Worth testing at larger N.
4. **The escalation-impossible-task scenario is unusable for skill experiments**: At 0/24, it's a universal floor. Any future skill experiments should use different scenarios.

## Cross-References

- **EXP-153**: Full experiment — `agents/shared/knowledge/experiments/EXP-153/`
- **KE-170**: Ceiling effect predecessor — skills redundant at ceiling (EXP-152)
- **KE-021**: Process > Knowledge > Judgment skill effectiveness ranking
- **KE-011**: Knowledge files are passive — agents skip them in oneshot mode
- **KE-010**: Most gym scenarios at ceiling — combined with KE-175, the usable scenario band is narrow
- **H-153**: NOT SUPPORTED — ≥15pp improvement on primary scenario did not materialize (0pp observed)
- **H-107**: Difficulty threshold — KE-175 extends the lower bound (floors are also uninformative)
