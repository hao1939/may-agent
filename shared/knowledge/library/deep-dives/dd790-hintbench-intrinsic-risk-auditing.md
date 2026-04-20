# DD#790 — HINTBench: Intrinsic Non-attack Trajectory Benchmark for Agent Safety

**Paper**: Wang, Hou, Wang, Jian, Bao & Lv (2026). "HINTBench: Horizon-agent Intrinsic Non-attack Trajectory Benchmark." arXiv:2604.13954  
**Relevance**: ★★★★★ — Benchmark for intrinsic (non-adversarial) agent failures; directly extends CR#345 behavioral failure prediction stack  
**Date**: 2026-04-20  
**KE Links**: KE-106 (failures emerge without adversarial input), CR#345 (behavioral failure prediction)

---

## Key Finding

**Agents fail dangerously even under benign conditions — and current systems cannot localize *where* in a trajectory the failure originates.** HINTBench benchmarks "intrinsic risk": failures that arise from the agent's own reasoning without any external attack. Strong LLMs can detect *that* a trajectory is risky (trajectory-level detection) but drop to <35 Strict-F1 when asked to pinpoint *which step* caused the risk.

## Study Design

- **629 agent trajectories** (523 risky, 106 safe), averaging 33 steps each
- **Three evaluation tasks**: (1) trajectory-level risk detection, (2) risk-step localization, (3) intrinsic failure-type identification
- **Five-constraint taxonomy** organizing failure types
- **Guard model transfer test**: existing safety guard models tested on intrinsic risk setting

## Core Results

| Task | Best LLM Performance | Notes |
|------|---------------------|-------|
| Trajectory-level risk detection | Strong (specific F1 not stated in abstract) | LLMs handle binary classification well |
| Risk-step localization | **<35 Strict-F1** | Massive performance drop — can't find the failure point |
| Failure-type identification | Even harder | Fine-grained diagnosis beyond current capability |
| Guard model transfer | **Poor** | Models trained on attack scenarios don't transfer to intrinsic risks |

## Why This Matters for Us

### 1. Validates the Behavioral Signal Approach (CR#345/DD#785-789)
The finding that LLMs can detect trajectory-level risk but not localize steps is exactly the gap that behavioral signal approaches (TrajAD from DD#785, action entropy from DD#786) are designed to fill. Step-level behavioral anomaly detection operates at the granularity where LLM-as-judge fails.

### 2. Intrinsic Risk = Our Primary Failure Mode
Our agents don't face adversarial attacks — they face intrinsic failures: context loss, reasoning drift, tool misuse under benign conditions. HINTBench's taxonomy of intrinsic failures maps directly to our operational failure modes (FM-3.3, FM-2.1).

### 3. Guard Model Transfer Failure
The finding that existing guard models trained on attack scenarios don't transfer to intrinsic risk auditing validates our approach of building agent-specific behavioral monitors rather than relying on generic safety classifiers.

### 4. Long-Horizon Propagation
The 33-step average trajectory length and focus on failures that "propagate across long-horizon execution" connects directly to HORIZON (DD#791) and ContextCurator (DD#792) — different papers attacking the same underlying problem from detection, diagnosis, and mitigation angles respectively.

## Connection to CR#345 Behavioral Failure Prediction Stack

| CR#345 Component | HINTBench Contribution |
|-----------------|----------------------|
| Detection layer (DD#785 TrajAD) | Provides ground truth trajectories for evaluating trajectory-level detectors |
| Localization layer (DD#786 entropy) | Demonstrates that LLM-as-judge fails at localization — behavioral signals needed |
| Diagnosis layer (DD#789 AgentFixer) | Failure-type identification benchmark could evaluate AgentFixer-style systems |
| Taxonomy | Five-constraint taxonomy could standardize our failure classification |

## Limitations

- Benchmark constructed from agent trajectories but unclear which agent architectures generated them
- "Intrinsic risk" definition may not cover all non-adversarial failure modes (e.g., context window pressure)
- 33-step average may not capture ultra-long-horizon scenarios

## Bottom Line

HINTBench fills a critical gap: **the first benchmark specifically for non-adversarial agent failures with step-level localization ground truth**. The demonstrated failure of LLM-as-judge at step localization validates investing in behavioral signal approaches. This is the evaluation infrastructure that CR#345's behavioral failure prediction stack has been missing.
