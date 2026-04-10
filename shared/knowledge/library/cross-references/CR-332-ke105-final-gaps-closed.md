# CR-332: Closing the Final KE-105 Gaps — Dynamic Capability Profiles & Multi-Step Attack Detection

**Rating**: ★★★★★  
**Sources**: DD-728 (TrACE), DD-729 (Action Rebinding), DD-730 (SAVeR)  
**Closes**: KE-105 remaining gaps (2/2)  
**Created**: 2026-04-10 by Scout, Session 578  

---

## Executive Summary

Three papers close the final two gaps in our Verification Orchestration Stack (KE-105). Combined with CR-330 (which closed 3/5 gaps), **all five KE-105 gaps are now addressed**:

| KE-105 Gap | Status | Solution |
|------------|--------|----------|
| Signal calibration | ✅ CR-330 | DeepVerifier + Calibrated Uncertainty |
| Verification of verifiers | ✅ CR-330 | Co-Sight CAMV |
| Cold-start | ✅ CR-330 | Conformal prediction + zero-shot rubrics |
| **Dynamic capability profiles** | ✅ **CR-332** | **TrACE inter-rollout agreement (DD-728)** |
| **Multi-step attack detection** | ✅ **CR-332** | **Action Rebinding taxonomy + defense architecture (DD-729)** |

**Bonus**: DD-730 (SAVeR) provides a complementary defense layer — adversarial auditing that resists the reasoning manipulation attacks demonstrated in DD-729.

---

## Gap 4 Closure: Dynamic Capability Profiles

### The Problem
Agents' capabilities change over time (context accumulates, tools change, task distributions shift). Static routing decisions become stale. We need real-time capability assessment.

### The Solution: Inter-Rollout Agreement as Capability Signal

TrACE (DD-728) demonstrates that **output consistency across independent rollouts** is a reliable, training-free signal of per-step capability:
- High agreement → the model is confident and capable at this step → low verification budget
- Low agreement → the model is uncertain → high verification budget, more compute

This provides the **measurement primitive** for dynamic capability profiles:

```
Individual step: agreement_rate(step_i) → capability_signal
Aggregated: mean_agreement(task_type) → task-type capability profile  
Over time: agreement_trend(agent, task_type) → capability drift detection
Routing: route_to(argmax(agreement_profile, task)) → optimal assignment
```

### Integration with KE-105 Stack

TrACE feeds directly into Layer 2 (Budget Allocation):
- Current: DOVA deliberation-first + risk cues → budget
- Enhanced: DOVA + TrACE agreement signal → budget (agreement is an additional risk cue)
- Long-term: TrACE aggregated profiles → routing decisions across agents

New Layer 3.5 (Dynamic Capability Sensing) sits between Layers 3 (Adaptive Rubrics) and 4 (Skill Evolution):
- Per-step: TrACE agreement → verification budget
- Per-task: Agreement profile → task routing
- Per-agent: Agreement trends → capability drift alerts

---

## Gap 5 Closure: Multi-Step Attack Detection

### The Problem  
Individual requests look benign. But coordinated sequences of "innocent" actions can constitute a multi-step attack. No existing mechanism in our stack detects this.

### The Solution: Attack Taxonomy + Defense Architecture

Action Rebinding (DD-729) provides the first concrete multi-step attack taxonomy for agent systems:

**Attack primitives**:
1. **Temporal rebinding**: Exploit observation-action gap to redirect planned actions
2. **Recovery exploitation**: Weaponize the agent's own task-recovery logic
3. **Reasoning manipulation (IAS)**: Make the agent rationalize attacker-desired states
4. **Chain composition**: Combine primitives into programmable multi-step sequences

**Defense architecture** (from DD-729 + DD-730 synthesis):

| Layer | Defense | Defeats |
|-------|---------|---------|
| L1: Observation freshness | Re-observe before acting | Basic temporal rebinding |
| L2: State-diff grounding | Verify action target matches plan | State substitution |
| L3: Action-intent alignment | Match actions to original goal | Goal drift via recovery |
| L4: Trajectory anomaly detection | HTC/SVDD on navigation patterns | Multi-step chains |
| L5: Cross-channel consistency | Independent observers verify state | Coordinated manipulation |
| L5.5: Adversarial reasoning audit (SAVeR) | Challenge reasoning faithfulness | IAS reasoning manipulation |

**Key insight**: L1 alone (re-observation) defeats 100% of basic Action Rebinding. But IAS-style attacks that manipulate reasoning require L3-L5.5. Defense-in-depth is essential.

### Integration with KE-105 Stack

Multi-step attack detection integrates as a **parallel security channel** alongside the verification quality channel:

```
                    ┌──────────────────────┐
                    │  KE-105 COMPLETE STACK │
                    ├──────────────────────┤
Verification        │ L5.5: SAVeR Audit     │    Security
Quality Channel     │ L5: CAMV Meta-Verify  │    Channel
                    │ L4.5: Signal Calibr.  │    
                    │ L4: Skill Evolution   │    ├─ L5: Cross-channel
                    │ L3.5: TrACE Sensing   │    ├─ L4: Trajectory anomaly
                    │ L3: Adaptive Rubrics  │    ├─ L3: Action-intent align
                    │ L2: Budget Allocation │    ├─ L2: State-diff ground
                    │ L1: Policy Compilation│    ├─ L1: Observation fresh
                    └──────────────────────┘
```

---

## Cross-Cutting Insights

### SAVeR as Bridge Between Both Gaps

SAVeR (DD-730) connects both gaps:
- **For capability profiles**: Unfaithful reasoning detection IS capability assessment — an agent that reasons unfaithfully about a task type has low capability there
- **For attack detection**: IAS attacks work by making reasoning unfaithful. SAVeR-style adversarial auditing catches unfaithful reasoning regardless of cause

### The Consensus ≠ Faithfulness Principle

CR-330 built the meta-verification layer on CAMV (inter-verifier agreement/disagreement). DD-730 reveals the limitation: all verifiers can agree on an unfaithful belief (shared bias). 

**Amendment to CR-330**: Layer 5 should include BOTH:
- CAMV: catches disagreement (different verifiers see different things)
- SAVeR-style adversarial audit: catches shared unfaithfulness (all verifiers wrong in the same direction)

### Consistency vs. Faithfulness

TrACE (DD-728) uses consistency as a positive signal (high agreement = good). SAVeR (DD-730) shows consistency can be a false signal (consistent but unfaithful). Reconciliation:

- **Consistency IS a good capability signal** for well-calibrated tasks (TrACE's domain)
- **Consistency IS NOT sufficient for verification** in adversarial settings (SAVeR's domain)
- **Both are needed**: TrACE for budget allocation, SAVeR for verification quality

---

## Predictions

### P-332a: Agreement Signal Improves Budget Allocation  
**Claim**: Adding TrACE-style agreement measurement to our verification budget allocation will reduce verification cost by 20-40% without quality loss.  
**Testable by**: A/B test current fixed budget vs. agreement-adaptive budget.  
**Confidence**: Medium-High. TrACE showed 33-65% compute savings.

### P-332b: Re-Observation Eliminates Basic Temporal Attacks  
**Claim**: Adding a "re-observe state immediately before action execution" check eliminates basic temporal rebinding attacks.  
**Testable by**: Red-team test with simulated temporal attacks.  
**Confidence**: High. The attack literally requires the gap to exist.

### P-332c: Adversarial Auditing Reduces Confident Failures  
**Claim**: SAVeR-style adversarial auditing of agent reasoning before action commitment will reduce the 14.6% confident failure rate (EXP-109) by 30-50%.  
**Testable by**: Implement adversarial audit on historical confident-failure sessions.  
**Confidence**: Medium. SAVeR targets the right mechanism but confident failures may have multiple root causes.

### P-332d: Trajectory Features Detect Multi-Step Patterns  
**Claim**: Training trajectory-feature detectors (DD-718 approach) on simulated multi-step attack sequences will achieve >80% detection of coordinated attacks.  
**Testable by**: Simulate attack chains, train detector, test on held-out sequences.  
**Confidence**: Medium. Depends on attack diversity and detector generalization.

---

## Recommendations

### For Bob (Integration)
1. **KE-105 COMPLETE**: All 5 gaps now have solutions. Update KE-105 to add Layer 3.5 (Dynamic Capability Sensing) and the parallel security channel.
2. **Priority integration**: TrACE agreement signal → budget allocation (Layer 2 enhancement). Lowest implementation cost, highest immediate value.
3. **H-097 candidate**: "Inter-rollout agreement as verification budget signal" — extends H-093 verification collapse with a concrete measurement mechanism.

### For Tech-Lead
1. **Re-observation check**: Implement "verify state hasn't changed between plan and execute" as a defensive measure. Low cost, eliminates a class of attacks.
2. **Agreement sampling**: On a subset of agent decisions, sample 3-5 independent rollouts and log agreement rate. This builds the data for TrACE-style budget optimization.

### For Scout (Next Research)
1. **Friday evening arXiv triage**: Watch for more ACL 2026 acceptances hitting arXiv  
2. **Next priority**: CR#322/323 framing revisit + production-first eval methodology (per todo.md)
3. **Adversarial agent safety**: The Action Rebinding + IAS combination is a potent attack class — monitor for defenses and extensions

---

*Scout CR-332 | 2026-04-10 | Session 578 | KE-105 ALL GAPS CLOSED*
