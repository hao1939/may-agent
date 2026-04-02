# Cross-Reference: Policy-Parameterized Prompts × Heterogeneous Goals × Unified Framework

**Papers Connected:**
- arXiv:2603.09890 — "Influencing LLM Multi-Agent Dialogue via Policy-Parameterized Prompts" (Bo et al.)
- arXiv:2603.07253 — "Learning When to Cooperate Under Heterogeneous Goals" (Taylor-Davies et al.)
- Grand Unified Synthesis (Scout Workspace)
**Date:** 2026-03-13

---

## The Prompt-Goal Duality

These two papers illuminate a fundamental duality in multi-agent systems:

1. **Bo et al.** shows that agent behavior can be controlled through **prompt construction** — the T/M/D/R/W decomposition creates a five-dimensional behavioral control surface
2. **Taylor-Davies et al.** shows that effective cooperation requires solving the **meta-cooperation problem** — deciding *whether* to cooperate before *how* to cooperate

The duality: **prompts parameterize how agents behave; goals determine what agents should pursue.** In LLM multi-agent systems, these two axes are often conflated — an agent's prompt contains both its behavioral style AND its objectives. The combined insight suggests they should be **decoupled**:

- **Goal selection layer** (analogous to π_goal): Which objectives to pursue, informed by teammate modeling
- **Behavioral control layer** (analogous to T/M/D/R/W weights): How to express and pursue those objectives

---

## Three-Level Agent Architecture (Synthesis)

Combining both papers' architectures suggests a three-level hierarchy for LLM multi-agent systems:

### Level 1: Goal Selection (Strategic)
- **Input:** Observable cues ϕ from teammates, own goal set G^ego
- **Output:** Selected goal subset G★ (worthwhile goals)
- **Mechanism:** Explicit teammate modeling when cues are noisy; heuristic when cues are clear
- **From:** Taylor-Davies et al.

### Level 2: Prompt Construction (Tactical)
- **Input:** Selected goals G★, current state (memory, knowledge, persona)
- **Output:** Parameterized prompt with T/M/D/R/W components
- **Mechanism:** Weight scheduling (temporal + behavioral correction)
- **From:** Bo et al.

### Level 3: Action Execution (Operational)
- **Input:** Constructed prompt
- **Output:** Natural language response
- **Mechanism:** LLM inference
- **From:** Both papers (implicit)

### Key Insight: Level Universality
Taylor-Davies found that low-level policies are **universal** while high-level goal selection must be **adaptive**. Bo et al. found that rule templates (R) create global behavioral constraints while weights (W) enable agent-specific tuning. Together: **the lower the level, the more it can be standardized; the higher the level, the more it must be personalized.**

---

## Failure Mode Mapping

Taylor-Davies's three failure modes map onto Bo et al.'s behavioral metrics:

| Failure Mode | Bo et al. Analog | Detection Metric |
|-------------|-----------------|------------------|
| Wrong goals | Low responsiveness to relevant query | Responsiveness < 0.7 |
| Over-cooperation | High memory weight + low evidence | w_M >> w_D and Evidence < 0.15 |
| Under-cooperation | Low rebuttal + high non-repetition | Rebuttal < 0.1 despite opposing stance |

The Struct template in Bo et al. may inadvertently promote **under-cooperation** — by forcing agents into structured extraction of supporting/opposing points, it reduces spontaneous engagement and rebuttal. This mirrors Taylor-Davies's finding that sophisticated reasoning can make agents too conservative about cooperation.

---

## Integration with Unified Framework Laws

### Law 3 Extended: Role Specialization Requires Goal Differentiation
Bo et al.'s persona component T defines roles. Taylor-Davies's G^i defines goals. True role specialization requires BOTH:
- Different T → different behavioral style
- Different G → different objectives
- The interaction: agents with the same G but different T may collaborate better (complementary approaches to shared goals) than agents with different G but same T (competing approaches to different goals)

### New Insight — Law 8 Candidate: The Meta-Cooperation Law
*"In heterogeneous-goal multi-agent systems, cooperation quality is limited by the system's ability to detect goal overlap. Agents that cannot distinguish between overlapping and non-overlapping goals will either over-cooperate (wasting effort on unachievable collaborative goals) or under-cooperate (missing achievable collaborative opportunities). The optimal cooperation strategy requires observable cues of sufficient fidelity, with explicit teammate modeling serving as a noise-reduction mechanism."*

### Intelligence Paradox Connection
Both papers exhibit aspects of the paradox:
- **Bo et al.:** Struct templates (most sophisticated) suppress evidence usage despite improving novelty
- **Taylor-Davies:** GRILL (most sophisticated) still under-cooperates — its careful goal reasoning makes it overly cautious about collaboration
- **Synthesis:** Sophistication → caution → under-cooperation/under-engagement. There's an optimal level of meta-reasoning beyond which agents become too conservative.

---

## Practical Implications for LLM Multi-Agent Systems

1. **Separate goal management from behavioral control** — don't conflate "what to do" with "how to do it" in agent prompts
2. **Make goals observable** — agents should communicate their objectives explicitly (low σ²); when they can't, build teammate models
3. **Use Light rules, not Struct** — moderate structure produces the best behavioral balance; over-structuring creates a different kind of degradation
4. **Implement adaptive weight scheduling** — early interactions need more knowledge grounding (w_D↑); later interactions need more memory engagement (w_M↑)
5. **Monitor for under-cooperation** — the most insidious failure mode is agents that could collaborate but don't; track cooperativity difference Δ_coop as a system health metric

---

## Open Questions

1. Can Bo et al.'s weight scheduling be made goal-aware? (i.e., w_M increases faster when pursuing cooperative goals)
2. Does the three-level architecture scale to 10+ heterogeneous agents?
3. Can Taylor-Davies's cue mechanism be implemented through LLM-native channels (e.g., chain-of-thought as observable cue)?
4. Is there a principled way to search the R/W space rather than hand-designing rule templates?
