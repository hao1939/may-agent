# CR#324 Synthesis: Next-Generation Verification + Routing Architecture

**Date**: 2026-04-18 | **Author**: Bob
**Sources**: KE-223 (GLEAN calibration), KE-224 (BiRouter+KBA routing), H-172 (calibrated verification hypothesis)

---

## Executive Summary

Three CR#324 gap-fills compose into a coherent 3-layer architecture where **calibrated confidence signals** (from GLEAN-style Bayesian calibration) feed both **verification budget allocation** and **dynamic agent routing**. The key insight: calibration is the connective tissue — it transforms raw signals into probabilities that both the verification stack and the routing layer can consume.

## How the Three Pieces Compose

```
                    ┌─────────────────────┐
                    │  Domain Guidelines   │  (DD-701 policy DSL)
                    └─────────┬───────────┘
                              │ compile
                    ┌─────────▼───────────┐
  Layer 1:          │  Signal Calibration  │  KE-223 / GLEAN
  CALIBRATION       │  (Bayesian logistic  │  Raw signals → calibrated
                    │   over guideline     │  confidence probabilities
                    │   alignment scores)  │
                    └────┬────────────┬────┘
                         │            │
              confidence │            │ uncertainty
              scores     │            │ estimates
                         │            │
           ┌─────────────▼──┐   ┌─────▼──────────────┐
  Layer 2: │  Budget Alloc   │   │  Dynamic Routing    │  KE-224
  DECISION │  (DD-702/DOVA)  │   │  BiRouter ImpScore  │  BiRouter + KBA
           │  Spend more on  │   │  × GapScore + KBA   │
           │  uncertain cases│   │  ACK capability     │
           └────────┬────────┘   │  discovery          │
                    │            └─────────┬───────────┘
                    │                      │
           ┌────────▼──────────────────────▼──┐
  Layer 3: │  Runtime Enforcement (DD-703)     │
           │  + Outcome Feedback → reputation  │
           └──────────────────────────────────┘
```

## Key Connections

### 1. Calibration feeds routing (strongest link)
KE-223's calibrated confidence directly enables KE-224's routing optimization. BiRouter's GapScore (contextual fit) can incorporate how *confident* the verification layer is about an agent's recent work quality — not just binary FM counts but calibrated competence estimates per task type.

### 2. Uncertainty drives both budget and dispatch
GLEAN's "expand checks for uncertain cases" and BiRouter's "route to highest-fit agent" are dual responses to the same signal: uncertainty. High uncertainty → more verification budget (Layer 2a) AND route to more capable agent (Layer 2b). These should share the same uncertainty estimate.

### 3. KBA ACK solves GLEAN's cold-start
GLEAN needs domain guidelines to calibrate against. KBA's self-assessment protocol could bootstrap this: agents that ACK a task type implicitly signal they have relevant internal "guidelines" (knowledge).

### Tension: Centralized vs. Decentralized
Both BiRouter and KBA assume decentralized routing. Our architecture is centralized (tech-lead dispatches). The mechanisms still apply but need adaptation — tech-lead queries agents for ACK signals rather than agents self-organizing.

## Ranked Findings (Impact × Novelty)

| Rank | Finding | Impact | Novelty | Source |
|------|---------|--------|---------|--------|
| 1 | Bayesian calibration as connective tissue between verification and routing | ★★★★★ | ★★★★ | KE-223 + H-172 |
| 2 | Dual-criteria routing (ImpScore × GapScore) captures both competence and context heat | ★★★★ | ★★★ | KE-224 |
| 3 | ACK-based capability discovery replaces static agent descriptions | ★★★★ | ★★★ | KE-224 |
| 4 | Active verification = uncertainty-driven budget allocation (unifies GLEAN + DOVA) | ★★★ | ★★★★ | KE-223 |
| 5 | Reputation/outcome feedback loop already exists in FM system but unused for routing | ★★★ | ★★ | KE-224 |

## Proposed Next Steps

1. **H-172 test** (highest priority): Run calibration experiment on 3 gym scenarios. Validates the foundation.
2. **Lightweight ACK trial**: Ask Bob+Scout to self-rate relevance (0-1) before dispatch. Zero infrastructure cost.
3. **Context heat tracking**: Log topic recency per agent as GapScore proxy.
4. **FM→routing feedback**: Surface FM rates by task-type in tech-lead's routing context.
5. **Full architecture design doc** (if H-172 confirmed): Specify 3-layer stack with interfaces and cold-start strategy.
