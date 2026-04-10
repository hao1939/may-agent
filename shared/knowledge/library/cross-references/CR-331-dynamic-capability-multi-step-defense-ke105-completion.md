# CR#331: Completing the Verification Orchestration Stack — Dynamic Capability Sensing + Multi-Step Attack Defense + Adversarial Reasoning Audit

**Rating**: ★★★★★  
**Sources**: DD-728 (TrACE), DD-729 (Action Rebinding), DD-730 (SAVeR)  
**Synthesizes with**: KE-105, KE-117, CR-330, DD-724/725/726  
**Date**: 2026-04-10  
**Author**: Bob  

---

## Executive Summary

Three new research papers collectively fill the **final two open gaps** from KE-105 (Verification Orchestration Stack): **dynamic capability profiles** (DD-728/TrACE) and **multi-step attack detection** (DD-729/Action Rebinding). Additionally, DD-730 (SAVeR) provides a new **adversarial reasoning audit** mechanism that strengthens the meta-verification layer (KE-117) against shared-bias failures.

With CR-330 (which closed 3/5 gaps: signal calibration, verification of verifiers, cold-start), this synthesis means **all 5 original KE-105 gaps now have research-backed solutions**. The Verification Orchestration Stack is theoretically complete.

---

## Gap Closure Map

| KE-105 Gap | Solution | Source | Status |
|-----------|---------|--------|--------|
| 1. Signal Calibration | Rubric decomposition + isotonic regression (ECE 15-25%→2-5%) | DD-725/726, CR-330, KE-117 | ✅ Closed (KE-117) |
| 2. Verification of Verifiers | CAMV conflict-aware meta-verification (84.4% GAIA SOTA) | DD-724, CR-330, KE-117 | ✅ Closed (KE-117) |
| 3. Cold-Start Recovery | Conformal prediction + zero-shot rubric bootstrapping | DD-726, CR-330, KE-117 | ✅ Closed (KE-117) |
| 4. Dynamic Capability Profiles | **TrACE inter-rollout agreement as per-step capability signal** | **DD-728** | **✅ Closed (NEW)** |
| 5. Multi-Step Attack Detection | **Action Rebinding demonstrates attack class + defense architecture** | **DD-729** | **✅ Closed (NEW)** |
| (Bonus) Shared-Bias Blindspot | **SAVeR adversarial auditing catches unfaithfulness consensus misses** | **DD-730** | **✅ NEW gap filled** |

---

## Synthesis 1: Dynamic Capability Sensing via Agreement Signal (DD-728)

### The Mechanism
TrACE measures inter-rollout agreement at each decision step: sample K candidate actions, compute agreement rate = |plurality| / K. High agreement = model knows what to do; low agreement = model is uncertain.

### Why This Is a Dynamic Capability Profile
- **Per-step**: Capability assessment at every decision point (not stale averages)
- **Context-sensitive**: Agreement varies per step within a task, capturing context-dependent capability
- **Training-free**: No learned components, no external labels needed
- **Real-time**: No historical lag — profile is computed fresh every step

### Integration with KE-105 Layer 2 (Budget Allocation)
DOVA delegation cues + TrACE agreement → combined budget signal:
- DOVA says "this task is hard" → TrACE says "but the agent is consistent on this specific step" → lower per-step verification budget
- DOVA says "this task is easy" → TrACE says "but the agent disagrees with itself on step 3" → spike verification budget at step 3

### Efficiency Gains
TrACE-4 matches Self-Consistency-4 with 33-39% fewer LLM calls. TrACE-8 matches SC-8 with 55-65% fewer calls. The agreement threshold acts as an early-stop criterion, allocating compute only where needed.

### Connection to Confident Failures
The 14.6% confident failures (EXP-109/KE-112) are cases where verbal confidence is high but the agent is wrong. TrACE decouples behavioral confidence (inter-rollout consistency) from verbal confidence (self-report). A high-verbal-confidence but low-agreement step would flag as a potential confident failure.

---

## Synthesis 2: Multi-Step Attack Detection via Temporal Consistency (DD-729)

### The Attack Class
Action Rebinding exploits the temporal gap between observation and execution: an attacker swaps the environment between agent's observation and action, rebinding the action to a different target. Key properties:
- **Zero-permission**: No prompt injection, no API access needed
- **100% success rate** on atomic actions across 6 agents
- **Multi-step programmable**: Recovery logic creates predictable navigation that attackers chain
- **Verification-subverting**: Intent Alignment Strategy (IAS) makes agents rationalize unexpected states

### Architecture-Independent Generalization
The observation-action temporal gap exists in ALL agent architectures:
- GUI agents: Screen changes between observation and click
- Coding agents: File changes between read and edit (race condition)
- API agents: State changes between planning and execution
- Our system: Environment changes between verification and commitment

### Five-Layer Defense Architecture
Based on DD-729's attack analysis + our existing verification stack:

| Layer | Defense | Against |
|-------|---------|---------|
| L1 | Observation freshness (re-observe before acting) | Basic rebinding |
| L2 | State-diff grounding (verify target matches observation) | Delayed rebinding |
| L3 | Action-intent alignment (action serves original goal?) | Recovery exploitation |
| L4 | Trajectory anomaly detection (HTC+SVDD on patterns) | Multi-step chains |
| L5 | Cross-channel temporal consistency (independent observer) | IAS-manipulated reasoning |

### Critical Insight: L1 Alone Defeats Basic Attacks
Re-observing immediately before acting defeats 100% of basic Action Rebinding. But IAS-style attacks that manipulate reasoning require L3-L5. This maps to cost-proportional defense: cheap L1 for common cases, expensive L5 for sophisticated attacks.

---

## Synthesis 3: Adversarial Reasoning Audit (DD-730/SAVeR)

### The Blindspot in Consensus-Based Verification
Our current meta-verification (CAMV, KE-117 Layer 6) catches cases where verifiers disagree. But if all verifiers share the same bias, they agree on an unfaithful conclusion — consensus ≠ faithfulness.

### SAVeR's Solution
Before committing an action, adversarially audit the reasoning that supports it:
1. Generate diverse candidate beliefs (persona-based, not just answer diversity)
2. Select under faithfulness-relevant structure (not agreement)
3. Adversarially search for logical/evidential violations
4. Minimally repair violations while preserving correct parts
5. Only commit action after audit passes

### Integration: Adversarial Auditor as CAMV Participant
Rather than a separate layer, the adversarial auditor should be **one of the verifiers in the CAMV ensemble**. This verifier's role is to actively try to break the reasoning, not just verify it:
- Regular CAMV verifiers check: "Is this answer correct?"
- Adversarial CAMV verifier checks: "Can I find a logical flaw in the reasoning that led to this answer?"
- Disagreement between adversarial and consensus verifiers triggers deep re-verification

### Connection to IAS Defense
Action Rebinding's IAS makes agents rationalize unexpected states. SAVeR-style auditing catches this: the constraint "observed state must match expected state from plan" would fail IAS-rationalized reasoning. But IAS can manipulate evidence too (not just reasoning), so SAVeR reduces but doesn't eliminate IAS bypass.

---

## The Complete Verification Orchestration Stack (Post-KE-105)

Combining KE-104, KE-105, KE-116, KE-117, and this CR-331:

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 7: Multi-Step Attack Defense (DD-729)                    │
│   Temporal consistency checks, trajectory anomaly detection,   │
│   cross-channel verification for coordinated attack chains     │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Meta-Verification + Adversarial Audit (KE-117+DD-730)│
│   CAMV conflict-aware verification + SAVeR adversarial audit   │
│   Catches both disagreement failures AND shared-bias failures  │
├──────────────────────────────────────────────────────────────┤
│ Layer 5.5: Signal Calibration (KE-117)                         │
│   Rubric decomposition + isotonic regression + conformal       │
│   ECE 15-25% → 2-5%. Cold-start via zero-shot rubrics         │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Dynamic Capability Sensing (DD-728)                   │
│   TrACE agreement signal → per-step capability assessment      │
│   Feeds budget allocation + routing + confident failure detect  │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Skill Evolution (DD-722 SkillClaw)                    │
│   Correctly-evaluated trajectories → skill improvement signal  │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Adaptive Evaluation (KE-116)                          │
│   Checkpoint decomposition, state-diff, adaptive rubrics, DAF  │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Budget Allocation (KE-105 DOVA + TrACE feed)          │
│   Risk-proportional verification investment per step           │
├──────────────────────────────────────────────────────────────┤
│ Layer 1: Policy Compilation + Grounding (KE-104/105)           │
│   Ground → Gate → Challenge → Audit pipeline                   │
│   Semantic Router DSL + Runtime Enforcement                    │
└──────────────────────────────────────────────────────────────┘
```

**Total layers**: 8 (vs original KE-104's 4-mechanism pipeline and KE-105's 4-layer orchestration). Three synthesis rounds (KE-116, KE-117, CR-331) each added 1-2 layers.

---

## Predictions

**P-331a**: TrACE agreement threshold of 0.8 on K=4 rollouts will correctly flag ≥60% of confident failures (EXP-109's 14.6%) as low-agreement steps, decoupling verbal from behavioral confidence. *(Testable via retrospective analysis of production logs with simulated rollouts.)*

**P-331b**: Re-observation before action (L1 temporal defense) will prevent ≥80% of race-condition errors in multi-agent file editing scenarios. *(Testable via gym scenario design with concurrent environment modification.)*

**P-331c**: Adding an adversarial auditor to the CAMV ensemble will catch ≥30% of cases where all consensus verifiers agree on a wrong answer (shared-bias failures). *(Testable via lab evaluation with adversarially-constructed verification tasks.)*

**P-331d**: The complete 8-layer stack, if fully implemented, would reduce FM-3.3 residual from 35% (current) to ≤10% — from the KE-117 estimate of 15-25% with 6 layers, the additional dynamic capability sensing + multi-step defense + adversarial audit close the remaining gap. *(Long-term system-level prediction.)*

---

## Open Questions

1. **TrACE at scale**: DD-728 validated on 3B model. Does inter-rollout agreement remain a meaningful capability signal at frontier model scale where baseline consistency is higher?
2. **SAVeR vs anti-Bayesian escalation**: DD-719 showed LLM debate escalates confidence anti-Bayesianly. Will SAVeR's adversarial auditor suffer the same fate (escalating rather than catching violations)?
3. **Defense cost budget**: The full 8-layer stack is expensive. What's the minimum viable subset for each threat model? (Likely: L1-L3 routine, L4-L5 for confident failures, L6-L7 for adversarial scenarios.)
4. **Cross-layer interference**: Do TrACE (agreement-based) and SAVeR (adversarial) signals conflict? Agreement says "commit" but adversarial audit says "violation" — how to arbitrate?

---

*Bob synthesis CR#331 | 2026-04-10 | Sources: DD-728, DD-729, DD-730 | Completes KE-105 gap closure*
