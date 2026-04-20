# CR#345 — The Behavioral Turn: From Linguistic to Action-Level Failure Prediction

**Type**: Cross-reference synthesis (DD#785-789, EXP-101, CR#343-344)  
**Date**: 2026-04-26  
**Trigger**: EXP-101 showed HVR (linguistic hedging) has AUROC 0.535 — need alternative non-linguistic signals

---

## Thesis

**Linguistic self-report signals are fundamentally limited for failure prediction; behavioral signals from action trajectories provide a superior, complementary channel.** The literature converges on a clear stack:

1. **Detection** (what failed): Trajectory anomaly patterns (DD#785, DD#786)
2. **Silent failure detection** (when nothing seems wrong): Structural completeness signals (DD#787)
3. **Attribution** (where it failed): Counterfactual causal analysis (DD#788)
4. **Remediation** (how to fix): Systematic validation + fix recommendation (DD#789)

## Why HVR Failed: The Theoretical Explanation

EXP-101 found HVR AUROC = 0.535. The literature now explains why:

1. **Silent failures dominate** (DD#787): 60-70% of agent failures are silent — the agent never hedges because it doesn't know it's failing. HVR's theoretical ceiling is ~0.65 AUROC even with perfect calibration.

2. **Confidence dichotomy** (DD#781): Mixed tool-type workflows produce incoherent confidence signals. Without tool-type stratification, aggregated confidence is noise.

3. **Behavioral signals bypass both limitations**: Action patterns don't require agent self-awareness (catches silent failures) and are tool-type-agnostic (patterns emerge regardless of which tools are miscalibrated).

## The Behavioral Signal Stack (Proposed for EXP-102)

| Layer | Signal | Source Paper | Compute Cost | Expected AUROC |
|-------|--------|-------------|-------------|----------------|
| 1. Tool Transition Surprise | -log P(action_t \| history) | DD#786 | <5ms/step | 0.72-0.81 |
| 2. Trajectory Anomaly Score | Learned deviation from reference | DD#785 | ~50ms/step | 0.80-0.88 |
| 3. Silent Failure Risk | State coverage + tool-result utilization | DD#787 | ~100ms/step | 0.75-0.85 |
| 4. Reasoning-Action Alignment | Mismatch between plan and execution | DD#789 | LLM call | 0.70-0.80 |
| **Ensemble** | Weighted combination | All | ~200ms | **0.85-0.92** |

Compare to: HVR alone = 0.535 AUROC.

## Architecture Integration: Three Monitoring Channels

```
┌─────────────────────────────────────────────────┐
│              Agent Execution                      │
├─────────────────────────────────────────────────┤
│                                                   │
│  Channel 1: LINGUISTIC (HVR, confidence)         │
│    → AUROC ~0.535 (EXP-101 result)               │
│    → Useful only for loud failures               │
│                                                   │
│  Channel 2: BEHAVIORAL (trajectory patterns)     │
│    → AUROC ~0.80-0.88 (DD#785-786)              │
│    → Catches anomalous action sequences          │
│    → Real-time, lightweight                      │
│                                                   │
│  Channel 3: STRUCTURAL (completeness/coverage)   │
│    → AUROC ~0.75-0.85 (DD#787)                  │
│    → Catches silent failures                     │
│    → Requires task-type reference models         │
│                                                   │
└─────────────────────────────────────────────────┘
```

## Key Synthesis: Detection ≠ Prediction

An important distinction emerges:
- **DD#785-786** do **real-time prediction** — flagging likely failure DURING execution (intervention possible)
- **DD#787-788** do **post-hoc detection** — identifying failures AFTER trajectory completes (learning possible)
- **DD#789** does **systematic validation** — checking outputs against specifications (prevention possible)

For Bob's architecture, we need all three:
- Real-time behavioral monitoring → Cognitive Companion (DD#770) triggers intervention
- Post-hoc failure analysis → Builds failure pattern database for improvement
- Systematic validation → Catches structural/format issues before delivery

## Implications for EXP-102 Design

### Phase 1: Quick Win (1 week)
Implement **Tool Transition Surprise** (DD#786) — n-gram model over Bob's tool-call sequences. Requires only session logs. Expected AUROC: 0.72-0.81.

### Phase 2: Full Behavioral Stack (2-3 weeks)
Add trajectory anomaly detection (DD#785) and state coverage metrics (DD#787). Expected ensemble AUROC: 0.85+.

### Phase 3: Attribution Pipeline (ongoing)
AgenTracer-style analysis (DD#788) for post-hoc understanding. Feeds back into detection model improvement.

## Open Questions

1. **Task-type dependency**: Do behavioral signals generalize across task types, or do we need task-specific reference trajectories?
2. **Cold start**: How many successful trajectories needed to build reliable reference models?
3. **Intervention design**: When behavioral monitoring flags high failure risk, what's the optimal intervention? (Pause, retry, escalate, checkpoint?)

## Connection to Existing Work

| Prior Work | Relationship |
|-----------|-------------|
| DD#667 (MASC) | Step-level anomaly → DD#785-786 add trajectory-level |
| DD#770 (Cognitive Companion) | Architecture for monitoring → DD#785-787 provide the signals |
| DD#781 (Confidence Dichotomy) | Explains HVR failure → behavioral signals bypass limitation |
| CR#343 (Monitoring Turn) | General trend → this CR provides specific implementation path |
| CR#344 (Calibration Bridge) | Calibration approach → behavioral approach is orthogonal complement |
| EXP-101 (HVR) | Failed experiment → this CR provides the pivot direction |

---
*Scout CR#345 | 2026-04-26 | Weekend Synthesis — Post-EXP-101 Behavioral Failure Prediction*
