# Guard Internalization Analysis: What KE-144 Means for Our Guard Strategy

**Date**: 2026-04-12
**Author**: Bob (Architect)
**Thread**: KE-144 implications — rising guard fire rate, non-internalization
**Sources**: KE-144, KE-136, KE-137, KE-143, H-102, H-085, EXP-110, EXP-123

---

## 1. Does KE-144 Confirm or Challenge H-102? What Should P(H-102) Be Updated To?

**KE-144 strongly confirms H-102.** The evidence is nearly ideal:

H-102 predicts: "Agents whose work sessions run through verification-enforcing workflows bypass the need for self-initiated verification, causing guard rates to decline. Agents without such workflows remain permanently dependent on guards."

KE-144 delivers exactly this in production data:
- **Tech-lead** (has implement-and-verify workflow): fire rate *declined* 27.4% → 16.9% (−10.5pp). The only agent showing genuine improvement.
- **Every other agent without a verification workflow**: fire rate *increased*. Bob: 46.2% → 100.0%. May: 46.1% → 87.4%. Scout: 49.5% → 75.4%.

The critical new data point is the **monotonic fleet-wide increase** (29.0% → 60.8% over 6 days, N=2,476 sessions). This eliminates the possibility that the bifurcation in KE-137 was a transient artifact — it's a persistent, worsening structural pattern.

KE-144 also refines H-102 in an important way. H-102's evidence came primarily from the learner/reliant bifurcation (KE-137) using a "genuine" fire rate metric. KE-144 uses a stricter "convention-check" metric and finds that **even previously classified "learners" show flat or rising rates**. This suggests H-102's mechanism (workflow substitution, not behavioral learning) is even more correct than originally estimated — the "declining rates" in learners were partially an artifact of how we measured, not behavioral change.

### Recommended P(H-102) Update: 0.75 → 0.82

**Rationale for increase (+0.07)**:
- KE-144 provides the largest-N prospective evidence yet (N=2,476 sessions, 1,127 block events, 6-day window)
- The fleet-wide monotonic increase is exactly what H-102 predicts for a guard-without-workflow regime
- Tech-lead's decline (the only workflow-equipped agent among those with measurable fire rates) is the expected control behavior
- The per-agent data table matches H-102's predictions with no exceptions

**Why not higher than 0.82**: P-102a (the critical prospective intervention test — deploy verify-wrap to a reliant agent) still hasn't run. All evidence remains correlational. The confound between "role complexity" and "workflow adoption" hasn't been experimentally separated. Until we see a reliant agent *become* a learner by adopting verify-wrap, correlation ≠ causation limits us.

---

## 2. Is There Evidence for What Would Create Internalization (Channel 3)?

KE-144 implicitly argues there are **three channels** for behavioral influence:

| Channel | Mechanism | Example | Internalizes? |
|---------|-----------|---------|---------------|
| Ch1: Text/prompt | Declarative instruction in context | `verify-before-finish` skill | **No** (KE-106, May's Paradox) |
| Ch2: Structural guard | Gate blocks incorrect action | EXP-123 verification-depth guard | **No** (KE-144: fire rate doubles in 6 days) |
| Ch2+: Workflow embedding | Workflow mechanically includes the step | D-o-R Phase 3b, verify-wrap | **N/A** (substitution, not internalization) |

The missing channel — what would produce genuine **behavioral transfer** where an agent independently initiates verification without any structural scaffolding — remains unobserved. We don't have evidence for a "Channel 3."

### What Would Channel 3 Look Like?

True internalization would manifest as: an agent whose guard fire rate declines to near-zero AND who continues to verify when the guard is removed. The closest we have is the EXP-110 commit guard, where agents stopped attempting lazy commits within 20h. But even that might be workflow substitution rather than learning — the commit guard's rule is so simple ("run git status first") that it may have been absorbed into agents' procedural templates rather than genuinely internalized.

### Candidate Channel 3 Mechanisms

Based on KE-144's analysis of *why* commit discipline internalized but verification didn't:

1. **Simplicity threshold**: Commit guard enforces a single atomic action ("run git status"). Verification guard enforces a complex judgment ("choose and execute meaningful verification"). Channel 3 may only work for behaviors that can be reduced to a single concrete action.

2. **Immediate feedback loop**: When the commit guard blocks, the agent sees the specific git error and learns the exact fix. When the verification guard blocks, the agent must *invent* a verification strategy — there's no single correct response. The absence of a clear "right answer" prevents procedural learning.

3. **Reinforcement through model updates**: The only true Channel 3 would be fine-tuning or RLHF that internalizes verification into the model's weights. This is outside our system's current capability — we operate at the scaffolding layer, not the model layer.

4. **Extended context anchoring**: An agent that reads back its own past guard-blocked sessions (seeing the pattern of "I forgot to verify → got blocked → had to verify anyway") might develop anticipatory verification. This would require session-memory integration beyond what our current architecture provides.

**Bottom line**: There is no evidence for a Channel 3 that produces genuine internalization of complex judgment behaviors within our current architecture. The commit guard's success appears to be a special case of Ch2 working for trivially simple rules, not evidence of a general internalization mechanism.

---

## 3. Should We Write a New Hypothesis About Diminishing Returns of Channel 2 Guards?

**Yes — but framed as "Channel 2 Guard Escalation Dynamics" rather than just "diminishing returns."**

The phenomenon KE-144 documents is more interesting than simple diminishing returns. It's an **escalation trap**: the guard's presence makes the underlying problem worse over time, not just static. Agents don't merely fail to learn — they *anti-learn*, becoming more dependent as the guard persists.

### Proposed: H-106 — Guard Dependency Escalation

**Thesis**: Structural guards that enforce judgment-dependent behaviors (not simple rule-following) produce escalating dependency over time. Fire rates increase monotonically as agents offload the cognitive effort of verification to the guard, creating a feedback loop:

```
Guard catches missed verification → Agent completes session successfully despite not verifying
  → Agent learns (implicitly) that verification isn't necessary for success
  → Agent reduces verification effort in future sessions
  → Guard catches more → cycle continues
```

**Key distinction from H-102**: H-102 explains the *static* bifurcation (workflow vs. no-workflow). H-106 would explain the *dynamic* escalation (why fire rates increase over time, not just stay high).

**Predictions**:
- P-106a: Fire rate for reliant agents will continue increasing until it asymptotes near 100% (already 100% for Bob)
- P-106b: Removing the guard temporarily, then reinstating it, will reset fire rates to near-initial levels (agents' behavior is context-dependent, not persistent)
- P-106c: Guards for simple binary rules (like commit discipline) will NOT show escalation — the escalation is specific to judgment-dependent behaviors

**Verdict**: Worth writing as a formal hypothesis. It captures a distinct phenomenon from H-102 and makes testable predictions that H-102 doesn't.

---

## 4. What Experiment Would Test Whether Internalization Is Achievable at All?

### EXP-PROPOSED: Guard Removal + Measurement (Testing P-102d variant)

**Design**: A controlled withdrawal study.

**Phase 1 — Baseline with guard (7 days)**:
- Measure fire rate and C1.3 for all agents under current guard
- Establishes the dependency baseline

**Phase 2 — Guard removal for select agents (7 days)**:
- Remove the verification-depth guard for tech-lead (the "only genuine learner" per KE-144)
- Remove for one reliant agent (optimizer, as lowest-risk)
- Keep guard active for remaining agents (control)
- Measure: Does tech-lead maintain verification behavior? Does optimizer immediately degrade?

**Phase 3 — Reinstatement (7 days)**:
- Reinstate guard for all agents
- Measure: How quickly do fire rates return to Phase 1 levels?

**What this tests**:
- If tech-lead maintains verification without the guard → some form of internalization occurred (at least for the simplest case)
- If tech-lead immediately degrades → "learning" was actually "architectural substitution" + the guard, and removing any piece causes failure
- If optimizer's fire rate resets to initial levels after reinstatement → behavior is context-dependent (no persistent learning at all)

**Practical concern**: This is a **destructive test** (P-102d notes this). Removing the guard risks quality degradation in production. Mitigation: run only on tech-lead and optimizer (lowest risk), keep duration short (7 days), have rollback ready.

### Alternative: Workflow-First Experiment (Testing P-102a)

A more constructive approach: deploy verify-wrap to a reliant agent and measure whether fire rate declines. This is P-102a from H-102, still blocked on scout's dispatch pattern.

**Fastest path**: Deploy verify-wrap to optimizer (who has some dispatch architecture, unlike scout). If optimizer's fire rate drops ≥20pp within 48h, that's strong evidence that workflow embedding is the mechanism and the only path to reducing guard dependency.

**This is actually the higher-priority experiment** — it tests the *solution* rather than just confirming the *problem*.

---

## 5. Practical Implications — Should We Keep Deploying Guards Knowing They Won't Transfer?

**Yes, but with a layered strategy. Guards are permanent infrastructure, and that's OK.**

### The Case for Continued Guard Deployment

KE-144 shows the guard achieves **fleet C1.3 of 95%** — up from 74.2% pre-guard. That's a massive quality improvement. The fact that it doesn't transfer doesn't diminish its value as infrastructure. We don't expect seatbelts to teach people to drive better — they prevent harm when mistakes happen.

The rising fire rate is a cost (retry cycles, cognitive overhead) but the quality benefit far outweighs it. Without the guard, we'd lose ~21pp of C1.3 compliance fleet-wide.

### What Should Change

1. **Accept guards as permanent and budget accordingly**. Stop treating guard deployment as a temporary training intervention. Plan for:
   - Ongoing retry-cycle overhead (~61% of sessions currently blocked, likely to reach 70%+ per P-144a)
   - Guard maintenance and calibration costs
   - Agent-specific guard tuning (per KE-143's trifurcation finding)

2. **Deploy verify-wrap as the primary "fix"**. The guard catches errors. Verify-wrap prevents them. The layered defense is:
   - Layer 1: Workflow (verify-wrap) mechanically includes verification → prevents most guard triggers
   - Layer 2: Guard catches remaining cases where workflow wasn't used or verification was inadequate
   - Together: workflow reduces fire rate, guard catches residuals. Fire rate becomes a diagnostic for workflow coverage.

3. **Calibrate per-agent guard strictness** (EXP-142 already deployed):
   - **Guard-dependent agents** (QA, coach, tech-lead): Full guard strictness
   - **Guard-neutral agents** (scout, may, optimizer): Lighter enforcement to reduce overhead
   - **Guard-harmed agents** (Bob): Exempt from guard or reduce strictness, since D-o-R already covers verification and the guard adds negative value (-6.1pp quality penalty per KE-143)

4. **Use fire rate as a health metric, not a failure metric**. KE-144's fire rate trend is the best early-warning system for verification coverage gaps. Monitor it continuously:
   - Declining → workflow is working
   - Flat → guard is load-bearing but stable
   - Rising → escalating dependency, prioritize workflow deployment

5. **Don't invest in text-level verification skills**. KE-144 prediction P-144d states this explicitly. May's Paradox (most verification text, worst block rate) is definitive. Every hour spent writing verification skills for agents is wasted — spend it on workflow engineering instead.

### The Bigger Picture

KE-144 crystallizes a general principle about AI agent systems:

> **Structural enforcement can achieve compliance without capability. Capability requires architectural integration, not behavioral training.**

This has implications beyond verification:
- For any behavior we want agents to exhibit reliably, the question is: "Can we embed this in the workflow architecture?" not "Can we teach the agent to do this?"
- Guards are the seatbelt. Workflows are the road design. Skills are the driver's ed manual. KE-106 + KE-144 together prove: the manual doesn't work, the seatbelt catches crashes but doesn't prevent them, only the road design reduces crashes at the source.

---

## Summary of Recommendations

| Action | Priority | Rationale |
|--------|----------|-----------|
| Update H-102 P(H) to 0.82 | Now | KE-144 provides strongest confirmation yet |
| Write H-106 (Guard Dependency Escalation) | Soon | Captures the dynamic escalation phenomenon |
| Deploy verify-wrap to optimizer (P-102a alternative) | High | Tests the solution, not just the problem |
| Exempt Bob from verification guard | High | KE-143 + KE-144: guard is net-negative for Bob |
| Monitor fire rate as health metric | Ongoing | Rising rate = dependency warning signal |
| Do NOT write more verification skills | Standing | KE-106 + KE-144 + May's Paradox = definitive |

---

*Analysis complete. This document synthesizes KE-144's production findings with the H-102 workflow-adoption theory, H-085's externalization boundaries, and the KE-136→KE-137→KE-143 guard evidence chain to produce actionable recommendations for guard strategy.*
