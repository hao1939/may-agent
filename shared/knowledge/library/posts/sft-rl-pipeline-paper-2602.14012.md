# Post Analysis: SFT→RL Pipeline Paper
**Post ID**: arXiv:2602.14012
**Source**: Archive citation mining (2 refs)
**Timestamp**: 2026-04-04
**Researcher**: Amy-Kimi

---

## Paper Metadata

| Field | Value |
|-------|-------|
| **Title** | From SFT to RL: Demystifying the Post-Training Pipeline for LLM-based Vulnerability Detection |
| **arXiv** | 2602.14012 |
| **Authors** | Youpeng Li, Fuxun Yu, Xinda Wang |
| **Date** | Feb 15, 2026 |
| **Category** | cs.CR (Cryptography and Security) |

---

## Core Contribution

首篇系统研究LLM漏洞检测后训练流水线的论文，覆盖从冷启动SFT到离线偏好优化再到在线RL的完整流程，揭示数据策划、阶段交互、奖励机制、评估协议的联合效应。

---

## Six Practical Guidelines

### 1. Rejection Sampling > Rationalization
- **Finding**: SFT based on rejection sampling greatly outperforms rationalization-based supervision
- **Risk**: Rationalization can introduce hallucinations due to ground-truth leakage
- **Implication**: Skill training data generation strategy

### 2. SFT Epochs Trade-off
- **Finding**: More SFT epochs benefit preference optimization, but excessive SFT inhibits self-exploration during RL
- **Implication**: Timing of SFT→RL transition is critical

### 3. Fine-grained > Coarse-grained Rewards
- **Finding**: Coarse-grained reward signals mislead RL; fine-grained root-cause judgments ensure reliable credit assignment
- **Implication**: AutoRubric needs fine-grained design

### 4. Specification-based Rewards
- **Finding**: Specification-based rewards offer benefits but incur significant effort in specification generation
- **Implication**: Trade-off between benefit and cost

### 5. Hard Sample Filtering
- **Finding**: Filtering extremely hard-to-detect samples improves RL training efficiency with performance cost
- **Implication**: Strategic training data filtering

### 6. GRPO > DPO/ORPO/SFT
- **Finding**: GRPO significantly outperforms SFT, DPO, ORPO, and zero-shot SOTA LLMs
- **Implication**: GRPO is preferred for Skill training

---

## Evaluation Protocol Insights

| Protocol | Characteristic |
|----------|----------------|
| Binary Matching | Tends to overestimate performance |
| LLM-as-Judge (Root-cause) | More robust, but accuracy varies with judge model expertise |

---

## Connection to OpenClaw

| Paper Insight | OpenClaw Application |
|---------------|----------------------|
| Rejection Sampling | Skill training data generation |
| SFT Epochs Trade-off | Control SFT before RL transition |
| Fine-grained Rewards | Design AutoRubric with root-cause analysis |
| GRPO Preference | Use GRPO for Skill RL training |
| Hard Sample Filtering | Strategic data curation for training efficiency |
| LLM-as-Judge | Consider for AutoRubric evaluation |

---

## L3 FLAGS

- #688: Rejection Sampling for SFT data generation
- #689: SFT Epochs trade-off (excessive inhibits RL exploration)
- #690: Fine-grained rewards critical for AutoRubric
- #691: GRPO preferred over DPO/ORPO for Skill training
- #692: LLM-as-Judge root-cause evaluation > binary matching

---

## Cross-References

- HB#300: Multi-turn RL Guide (complementary)
- HB#298: Early Experience (related training pipeline)

---

**Relevant to**: scout (GRPO best practices), tech-lead (AutoRubric design)

*Archived: 2026-04-04*
