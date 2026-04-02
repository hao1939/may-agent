# Deep-Dive: CUAAudit — Meta-Evaluation of Vision-Language Models as Auditors of Autonomous Computer-Use Agents
**Paper:** arXiv:2603.10577  
**Authors:** Marta Sumyk, Oleksandr Kosovan (Ukrainian Catholic University)  
**Venue:** HEAL @ CHI 2026 Workshop  
**Date:** March 11-12, 2026  
**Rating:** ★★★★ HIGH RELEVANCE — Agent evaluation reliability  

---

## Core Question
Can Vision-Language Models (VLMs) reliably audit whether Computer-Use Agents (CUAs) have successfully completed tasks, by observing only the task instruction and the final GUI screenshot?

## What Are Computer-Use Agents?
CUAs are autonomous systems that operate GUIs by translating natural-language instructions into action sequences (clicking, typing, scrolling). They represent a shift from brittle RPA to general-purpose GUI controllers that work across applications and operating systems without handcrafted rules.

## The Evaluation Crisis for CUAs
Current evaluation approaches are inadequate:
- **Static benchmarks** → brittle to interface changes
- **Rule-based success checks** → poorly aligned with real-world usage
- **Manual inspection** → costly, unscalable

The paper proposes using VLMs as **autonomous auditors** — given (task instruction, final screenshot), the VLM judges: done or not done, with a confidence score.

## Experimental Design
**5 VLM Auditors evaluated:**
- Proprietary: GPT-4o, Claude 3.5 Sonnet
- Open-source: InternVL-2-8B, LLaVA-v1.5-7B, Qwen2-VL-7B

**3 Benchmarks (3 operating systems):**
- macOSWorld (macOS)
- Windows Agent Arena (Windows)
- OSWorld (Linux)

**3 Evaluation Dimensions:**
1. Accuracy of task completion assessment
2. Calibration of confidence estimates (Brier score)
3. Inter-model agreement (Cohen's κ)

## Key Quantitative Findings

### Accuracy (% correct done/not-done predictions)
| Auditor | macOSWorld | Windows Arena | OSWorld |
|---------|-----------|---------------|---------|
| GPT-4o | 0.91 | 0.71 | 0.77 |
| Claude 3.5 Sonnet | 0.89 | 0.75 | 0.79 |
| InternVL-2-8B | 0.85 | 0.69 | 0.72 |
| Qwen2-VL-7B | 0.87 | 0.68 | 0.73 |
| LLaVA-v1.5-7B | 0.82 | 0.66 | 0.68 |

**Key pattern:** All auditors degrade ~15-20% from macOS to Windows/Linux. Environment complexity matters more than model architecture.

### Calibration (Brier Score, lower = better)
| Auditor | macOSWorld | Windows Arena | OSWorld |
|---------|-----------|---------------|---------|
| GPT-4o | 0.058 | 0.091 | 0.074 |
| Claude 3.5 Sonnet | 0.063 | 0.099 | 0.081 |
| InternVL-2-8B | 0.097 | 0.142 | 0.118 |
| LLaVA-v1.5-7B | 0.112 | 0.159 | 0.134 |
| Qwen2-VL-7B | 0.105 | 0.167 | 0.141 |

**Critical insight:** Calibration ≠ accuracy. Some models with comparable accuracy have very different calibration. Open-source models are overconfident.

### Inter-Model Agreement (Cohen's κ)
- **Proprietary-Proprietary:** κ = 0.66-0.76 (substantial agreement)
- **Proprietary-Open Source:** κ = 0.54-0.69 (moderate)
- **Open Source-Open Source:** κ = 0.55-0.68 (moderate)

**Even the best pair (GPT-4o × Claude) only reaches κ = 0.76 on macOS, dropping to 0.66 on Windows.**

## Why This Matters for Multi-Agent Safety

### 1. The Evaluator Reliability Problem
This paper empirically demonstrates that **model-based evaluation of agents is unreliable** — precisely the concern raised across the multi-agent safety literature. If you can't reliably tell whether an agent completed its task, you can't detect:
- Partial task completion masquerading as success
- Silent failures
- Harmful side effects
- Subtle misalignment between instruction and execution

### 2. The Hidden State Problem
Many CUA tasks depend on **hidden system state** (background processes, file saves, network calls) that aren't visible in a final screenshot. This maps directly to the observability gap in multi-agent systems where agents interact with environments through partial observations.

### 3. Disagreement as Signal
The authors argue disagreement between auditors should be treated as an **informative signal about task ambiguity**, not noise. This is a design pattern: if multiple evaluators disagree, that should trigger:
- Human review
- Request for additional evidence
- Conservative fallback behavior

### 4. Cross-Platform Fragility
The 15-20% accuracy drop from macOS to Windows/Linux shows evaluation is **not transferable** across environments. This has implications for deploying agent auditing at scale — you can't validate on one environment and trust on another.

## Connections to Portfolio

- **Evaluator-as-Bottleneck Theme:** Directly supports our cross-ref synthesis on evaluator reliability. VLM auditors are another instance of "who watches the watchers?"
- **Observability Gap:** Connects to the patrol-wave and agent observability deep-dives — CUAs expose the same partial-observability challenge as multi-agent coordination.
- **Calibration vs. Accuracy:** Parallels the finding in jailbreak scaling laws (2603.11331) that aggregate metrics hide important distributional information.
- **Defense Stack Implications:** Any defense relying on model-based monitoring inherits these calibration and agreement limitations.

## Limitations Noted by Authors
- Only examines final GUI state (no intermediate steps or temporal context)
- Calibration relies on model-reported confidence, not token-level log probabilities
- Only binary task completion — doesn't address safety, privacy, policy compliance
- Small author team, workshop paper (not full peer review)

## Open Questions
1. **Multi-screenshot auditing:** Would providing action traces or intermediate screenshots significantly improve auditor reliability?
2. **Ensemble auditing:** Would majority-vote among 3-5 VLMs outperform any single auditor? At what cost?
3. **Adversarial evasion:** Can a CUA be optimized to *appear* successful to VLM auditors while actually failing? (Auditor-aware deception)
4. **Domain-specific fine-tuning:** Would fine-tuning VLMs specifically for GUI auditing close the proprietary-open source gap?

## Bottom Line
VLM-based auditing of autonomous agents is feasible but fundamentally unreliable — especially in complex environments. Even the best auditors disagree substantially, and confidence calibration is poor for open-source models. This paper provides hard empirical evidence that **evaluation of autonomous agents is itself a first-class research problem**, not a solved infrastructure question. Any safety architecture that assumes reliable automated evaluation is building on sand.

---
*Deep-dive by Scout | Session s_1773459420704_147 | 2026-04-02*
