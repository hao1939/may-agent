# DD#779: SmartSnap — Proactive Self-Verification via Evidence Seeking

**Paper:** SmartSnap: Proactive Evidence Seeking for Self-Verifying Agents
**Authors:** Shaofei Cai, Yulei Qin, Haojia Lin, Zihan Xu, Gang Li, Yuchen Shi, Zongyi Li, Yong Mao, Siqi Cai, Xiaoyu Tan, Yitao Liang, Ke Li, Xing Sun
**ArXiv:** 2512.22322 (December 2025, revised January 2026)
**Rating:** ★★★★
**Fills CR#324 gap:** Verification of verifiers (complementary angle)

---

## Core Contribution

Shifts verification from **passive post-hoc** (external verifier analyzes full trajectory) to **proactive in-situ** (agent itself collects evidence of task completion during execution). Introduces the **Self-Verifying Agent** — an agent with dual missions: complete the task AND prove it was completed correctly.

## Key Findings

1. **3C Principles**: Self-verification evidence must be Complete (covers all success criteria), Concise (minimal decisive set), and Creative (agent finds best evidence format). This dramatically reduces the context a verifier must process.

2. **Verification cost reduction**: By having the agent curate minimal snapshot evidence, the external verifier (LLM-as-a-Judge) only needs to check a small evidence set instead of the full interaction trajectory. This makes verification scalable.

3. **Performance gains**: 26.08% improvement for 8B models and 16.66% for 30B models on mobile GUI tasks. The dual mission (solve + prove) actually improves task completion — the agent reasons more carefully when it knows it must also verify.

4. **Evidence as verification of verification**: The curated snapshots serve as an audit trail that makes the verification process itself verifiable — a human or meta-verifier can inspect the evidence set rather than the entire trajectory.

## Relevance to CR#324

Provides a complementary approach to the verification-of-verifiers gap:

### Self-Verification as Meta-Verification
- Instead of asking "who checks the sentinels?", SmartSnap asks "what if agents provide proof of their own correctness?"
- The proof (evidence set) is a **compact, inspectable artifact** that makes verification transparent
- A meta-verifier only needs to check: (a) is the evidence set complete? (b) does each piece of evidence support the claimed outcome?

### Integration with Orchestration Stack
```
Layer 1 Enhancement: Self-Verification Protocol
├── Agent produces output + evidence set (3C Principles)
├── Sentinel (Layer 2) verifies evidence set (much cheaper than full trajectory)
├── If evidence is insufficient → escalate to deep verification
└── Evidence set serves as structural audit trace (connects to DD#701 DSL)
```

## Limitations

- Evaluated on GUI tasks; applicability to reasoning/coding agents unclear
- Agent could fabricate evidence (adversarial self-verification)
- Requires training the dual-mission capability via RL

## Connection to Our Work

- **DD#778 (Weak-Strong Verification)**: Self-verification is a form of weak verification; SmartSnap's evidence reduces the cost of strong verification when escalation is needed
- **DD#701 (Semantic Router DSL)**: Evidence sets are analogous to structural audit traces — both couple verification artifacts to the actual decision
- **CR#318 (Cascade Prevention)**: Self-verification could be an early warning for CIVC — if the agent can't produce evidence, that itself signals a problem

---
*Scout DD#779 | Session 798 | 2026-04-19*
