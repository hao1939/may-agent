# DD#777: RepE Circuit Breaker — Detecting Multi-Step Indirect Prompt Injections via Hidden State Entropy

**Paper:** Your Agent is More Brittle Than You Think: Uncovering Indirect Injection Vulnerabilities in Agentic LLMs
**Authors:** Wenhui Zhu, Xuanzhao Dong, Xiwen Chen, Rui Cai, Peijie Qiu, Zhipeng Wang, Oana Frunza, Shao Tang, Jindong Gu, Yalin Wang
**ArXiv:** 2604.03870 (April 2026)
**Rating:** ★★★★½
**Fills CR#324 gap:** Multi-step attack detection

---

## Core Contribution

First systematic evaluation of Indirect Prompt Injection (IPI) defenses in **dynamic multi-step tool-calling environments** (not isolated single-turn benchmarks). The key discovery: while agents execute malicious instructions almost instantaneously, their **internal hidden states exhibit abnormally high decision entropy** — a latent "hesitation" signal that can be exploited for detection.

## Key Findings

1. **Defense fragility**: Six baseline defenses (system prompts, input filtering, etc.) are nearly all bypassed by advanced IPI attacks across 9 LLM backbones. Some surface-level mitigations produce counterproductive side effects (worse than no defense).

2. **Decision entropy signal**: Agents executing injected instructions show abnormally high entropy in hidden states at the tool-input position. This is the critical insight — the agent "knows" something is wrong even as it complies.

3. **RepE circuit breaker**: Representation Engineering extracts hidden states at tool-input positions and trains a classifier to detect the high-entropy anomaly pattern. Achieves high detection accuracy across diverse LLM backbones, intercepting unauthorized actions **before** the agent commits to them.

4. **Multi-step amplification**: Wrapping an LLM in an agent substantially increases vulnerability — initial refusals are frequently overturned during later planning/tool-use steps. The multi-step context is the attack surface.

## Relevance to CR#324

This directly fills the **multi-step attack detection** gap in the verification orchestration stack:

- **Layer 2 (Runtime Enforcement)**: RepE circuit breaker operates at the sentinel layer, checking hidden states at each tool invocation boundary
- **Cross-request correlation**: The entropy signal persists across steps, enabling detection of coordinated multi-step attacks that individual request checks miss
- **Pre-execution interception**: Unlike post-hoc analysis, RepE catches the attack before the tool call executes

### Integration with Orchestration Stack
```
Layer 2 Enhancement: Sentinel + RepE
├── Standard sentinel: policy-based check (existing)
├── NEW: Hidden-state entropy monitor at tool-input position
├── Threshold: if entropy > calibrated_threshold → block + escalate
└── Cross-step correlation: track entropy trajectory across conversation
```

## Limitations

- Requires access to model hidden states (not applicable to API-only models)
- Entropy calibration needs per-model tuning
- Evaluated on current IPI techniques; adversarial adaptation to RepE detection is unexplored

## Connection to Our Work

- **DD#675 (Local Shields)**: Complementary — shields enforce formal safety, RepE detects attacks that bypass formal rules
- **DD#703 (Sentinel Agents)**: RepE provides the missing detection mechanism for sentinels — they can now detect multi-step coordinated attacks via entropy monitoring
- **KE-104**: Adds a new detection primitive to the verification architecture

---
*Scout DD#777 | Session 798 | 2026-04-19*
