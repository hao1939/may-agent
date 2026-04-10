# DD#728: TrACE — Inter-Rollout Agreement as Dynamic Capability Signal

**Rating**: ★★★★★  
**Paper**: "Don't Overthink It: Inter-Rollout Action Agreement as a Free Adaptive-Compute Signal for LLM Agents"  
**arXiv**: 2604.08369 (9 Apr 2026)  
**Author**: Khushal Sethi  
**Fills KE-105 Gap**: Dynamic Capability Profiles  

---

## Core Insight

An agent's **output consistency across independent rollouts** is a training-free, real-time signal of per-step capability. High agreement = easy step (model "knows" what to do) → commit immediately. Low agreement = hard step (model is uncertain) → allocate more compute. This IS a dynamic capability profile — the model's own behavior encodes what it can and can't reliably do, step by step.

## TrACE Mechanism

**TrACE = Trajectorical Adaptive Compute via agrEement**

```
For each decision step:
1. Sample K candidate next-actions (independent rollouts)
2. Measure agreement rate = |most-common-action| / K
3. If agreement ≥ threshold → commit immediately (easy step)
4. If agreement < threshold → sample more rollouts up to cap
5. Commit to plurality action
```

Key properties:
- **Training-free**: No learned components, no external verifier, no human labels
- **Per-timestep**: Capability assessment happens at EVERY decision point
- **Adaptive**: Compute budget varies with step difficulty
- **Self-referential**: Uses the model's OWN consistency as the signal

## Results

| Configuration | GSM8K Accuracy | GSM8K LLM Calls | MiniHouse Accuracy | MiniHouse LLM Calls |
|---------------|---------------|------------------|--------------------|--------------------|
| Greedy (1) | Baseline | 1× | Baseline | 1× |
| SC-4 (fixed) | +X% | 4× | +Y% | 4× |
| **TrACE-4** | **= SC-4** | **2.7× (33% fewer)** | **= SC-4** | **2.4× (39% fewer)** |
| SC-8 (fixed) | +X% | 8× | +Y% | 8× |
| **TrACE-8** | **= SC-8** | **3.6× (55% fewer)** | **= SC-8** | **2.8× (65% fewer)** |

The agreement signal reliably predicts step-level success, validating that consistency encodes difficulty.

## Why This Fills the Dynamic Capability Profile Gap

KE-105 identified the need for "dynamic capability profiles — agents improve over time, routing decisions become stale." TrACE provides the foundational mechanism:

1. **Real-time capability assessment**: At each step, agreement rate = capability confidence for that specific action type in that specific context
2. **No stale routing**: Profile is computed fresh every step — no historical lag
3. **Task-specific**: Agreement varies per step within a task, capturing context-dependent capability (not just agent-level averages)
4. **Composable**: Can aggregate step-level agreement into task-level capability estimates

### What TrACE is NOT (and what we still need)

TrACE gives us step-level capability assessment. For full dynamic capability profiles, we additionally need:
- **Temporal tracking**: How does agreement distribution change over sessions? (Drift detection)
- **Task-type aggregation**: Roll up step-level signals into "this agent is reliable at X but unreliable at Y"
- **Routing integration**: Use aggregated profiles to route tasks to agents best suited for them

But TrACE provides the **measurement primitive** that all of these require.

## Connection to Our System

### Direct application: Verification budget allocation
Our KE-105 Layer 2 (Budget Allocation) currently uses DOVA deliberation-first + risk cues. TrACE gives us a complementary signal:
- High agreement before an action → lower verification budget (the agent "knows" what it's doing)
- Low agreement → higher verification budget (the agent is uncertain, verification more likely to catch errors)

### Connection to EXP-109 confident failures
The 14.6% "confident failures" from production analysis — these are cases where the agent appears confident but is wrong. TrACE might detect some of these: if inter-rollout agreement is actually LOW despite verbalized confidence being HIGH, that's a red flag. This decouples behavioral confidence (consistency) from verbal confidence (self-report).

### Connection to DD#717 (HTC) 
HTC extracts trajectory features for confidence calibration. TrACE's agreement rate IS a trajectory feature — arguably the purest one. HTC's "macro dynamics" capture multi-step patterns; TrACE captures per-step consistency. They're complementary layers in the calibration stack.

### Connection to DD#720 (Plan-RewardBench)
Plan-RewardBench showed evaluators degrade at 16+ step horizons. TrACE operates per-step, so it doesn't suffer from horizon-length degradation. It's naturally local, which is exactly what the Evaluation Decomposition Principle (CR#329) recommends.

## Architectural Integration Proposal

```
┌─────────────────────────────────────────────────────┐
│  Layer 5: Meta-Verification (CR-330 CAMV)            │
├─────────────────────────────────────────────────────┤
│  Layer 4.5: Signal Calibration (CR-330 Isotonic)     │
├─────────────────────────────────────────────────────┤
│  Layer 4: Skill Evolution (DD-722 SkillClaw)         │
├─────────────────────────────────────────────────────┤
│  NEW Layer 3.5: Dynamic Capability Sensing           │
│    TrACE agreement signal → per-step capability      │
│    Temporal aggregation → agent capability profile    │
│    Profile → routing + budget + task assignment       │
├─────────────────────────────────────────────────────┤
│  Layer 3: Adaptive Rubrics (DD-723 AdaRubric)        │
├─────────────────────────────────────────────────────┤
│  Layer 2: Budget Allocation (KE-105 DOVA)            │
│    ← TrACE feeds budget decisions directly            │
├─────────────────────────────────────────────────────┤
│  Layer 1: Policy Compilation (KE-105 DSL)            │
└─────────────────────────────────────────────────────┘
```

## Key Limitation

Evaluated on 3B model on CPU with small samples (n=50, n=30). Needs validation at frontier model scale on real agent tasks. But the core hypothesis (consistency encodes difficulty) is validated and is model-size independent in principle.

---

*Scout DD#728 | 2026-04-10 | Session 578 | KE-105 gap: dynamic capability profiles*
