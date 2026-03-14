# LABSHIELD: Safety-Critical Reasoning and Planning in Scientific Laboratories

**Paper**: arXiv:2603.11987  
**Date**: March 12, 2026  
**Authors**: Qianpu Sun et al. (Peking University)  
**Tags**: #Safety #Benchmark #EmbodiedAI #MultiModal #AgentEvaluation

---

## Executive Summary

LABSHIELD is the first comprehensive multimodal benchmark for evaluating safety-critical reasoning and planning of MLLM agents in scientific laboratory environments. It reveals a **systematic 32% performance gap** between general-domain MCQ accuracy and embodied safety performance, exposing critical vulnerabilities in current AI systems.

---

## Core Framework: Perception-Reasoning-Planning (PRP)

LABSHIELD adapts the classical PRP architecture for safety evaluation:

```
┌─────────────────────────────────────────────────────────────┐
│              PRP Safety Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  (1) Safety-Aware Perception                                │
│      └─ Identify safety-critical anomalies (GHS symbols,    │
│          transparent glassware, liquid interfaces)          │
│                                                             │
│  (2) Safety-Grounded Reasoning                              │
│      └─ Causal reasoning over hazards (reagent incompat,    │
│          equipment states, latent risks)                    │
│                                                             │
│  (3) Safe-by-Design Planning                                │
│      └─ Generate safe action sequences + proactive refusal  │
│          of hazardous instructions                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Safety Taxonomy: Four-Tier System

| Tier | Description | Intervention Requirement | OpenClaw Mapping |
|------|-------------|-------------------------|------------------|
| **S0** | Harmless Operations | Autonomous execution | Normal execution |
| **S1** | Low-risk Scenarios | Verification or self-correction | Validation checkpoint |
| **S2** | Moderate-risk Hazards | **Stop & Alert** protocol | Abort + Human handoff |
| **S3** | High-risk Violations | **Unconditional task refusal** | L0宪法约束拒绝 |

**Critical Finding**: Models consistently **underestimate severe hazards** (S2/S3) despite catastrophic potential.

---

## Key Findings

### 1. The 32% Safety Gap

```
General-domain MCQ Accuracy    Embodied Safety Performance
        ↑                              ↓
    ~75% avg                      ~43% avg
                                  (-32% gap)
```

**Insight**: High MCQ accuracy is a **poor predictor** of safety performance in embodied settings.

### 2. Safety Scales with Hazard Awareness

Linear relationship discovered:
- **Unsafe Factor Identification (U-J)** ↔ Safety L23 Accuracy
- **Hazard Pattern Recognition (H-J)** ↔ Safety L23 Accuracy

Models that reliably identify unsafe factors achieve substantially better safety outcomes.

### 3. Reasoning Helps But Is Limited

| Model Type | Safety Behavior | Risk Underestimation |
|------------|-----------------|---------------------|
| Explicit reasoning (o3, Gemini-3-Pro) | More stable | Reduced |
| Non-reasoning | Fragile | Higher |

**Limitation**: Even reasoning models remain fragile in high-risk (S2/S3) scenarios.

### 4. Embodiment ≠ Safety

Embodiment-specific models (RoboBrain) **fail to yield significant safety dividend** over general MLLMs, even at larger scales.

> "Embodiment, in isolation, is insufficient for robust hazard perception and safety-aware decision-making."

---

## Performance Results (Selected Models)

| Model | MCQ Mean | Safety Score | S2/S3 Acc | Underestimation |
|-------|----------|--------------|-----------|-----------------|
| Human | 92.0 | 87.3 | 94.5 | 5.5 |
| GPT-o3 | 78.5 | 48.5 | 54.3 | 45.7 |
| Gemini-3-Pro | 77.1 | 52.6 | 77.1 | 22.9 |
| Claude-4-Sonnet | 73.2 | 51.2 | 72.1 | 26.5 |
| Qwen3-Ins-32B | 76.6 | 48.9 | 57.1 | 40.0 |

**Key Observation**: Best models achieve ~50% safety score vs human 87.3% — massive gap remains.

---

## Ablation Study Insights

### Safety Constraints Are Critical

```
With safety constraints:    ████████████ 52.6% (Safety Score)
Without constraints:        ████████     31.2% (-21.4%)
```

> "Without explicit safety framework, models fail to maintain consistent safety boundaries."

### Multi-View Integration

- Full multi-view (head + torso + dual wrist): Best overall
- Wrist-only views: Critical for fine-grained manipulation safety
- Head-only views: Insufficient for hazard identification

---

## Standards Foundation

LABSHIELD is grounded in:
- **OSHA 29 CFR 1910.1450** (Occupational Safety and Health Administration)
- **GHS** (Globally Harmonized System of Classification and Labelling of Chemicals)

This provides regulatory-grade safety taxonomy.

---

## Dataset Statistics

- **164 operational tasks** across 3 scenarios (Workbench, Fume Hood, Sink)
- **1,439 VQA pairs** (Perception/Reasoning/Planning)
- **4-view RGB-D streams** (head, torso, dual wrists)
- **14 unsafe factor categories**
- **12 hazard pattern categories**

---

## Connection to OpenClaw

### Direct Validation

| LABSHIELD Finding | OpenClaw Design | Alignment |
|-------------------|-----------------|-----------|
| Four-tier safety taxonomy (S0-S3) | L0-L3分级约束 | ✅ Direct mapping |
| Explicit safety constraints critical | AGENTS.md宪法约束 | ✅ Validated |
| MCQ accuracy ≠ safety | Error Log外部验证 | ✅ Alternative approach |
| Stop & Alert for S2 | Abort + Human handoff | ✅ Consistent |
| Unconditional refusal for S3 | L0宪法拒绝 | ✅ Consistent |
| Hazard perception → safety | Multi-view/context awareness | ⚠️ Research direction |

### Design Implications

1. **L0宪法约束的正确性**: S3级无条件拒绝是必要设计，非过度保守
2. **外部验证的必要性**: MCQ评估无法替代实际执行验证
3. **危险感知优先**: 系统需先识别不安全因素，再推理风险模式
4. **多视图上下文**: 单一视角不足以识别所有危险

---

## L3 Flags for OpenClaw

| ID | Flag | Priority | Source |
|----|------|----------|--------|
| #979 | S0-S3安全等级显式映射到OpenClaw约束层 | P1 | LABSHIELD |
| #980 | 危险感知模块: 识别14类不安全因素 | P2 | LABSHIELD |
| #981 | 风险模式推理: 12类危险模式分类 | P2 | LABSHIELD |
| #982 | 多视图上下文: 视觉输入危险识别 | P2 | LABSHIELD |
| #983 | MCQ评估≠安全: 避免依赖文本安全基准 | P1 | LABSHIELD |

---

## Key Quote

> "The decoupling of deliberation from execution means that cognitive errors or planning lapses are directly manifested as physical hazards in the real world."

This reinforces OpenClaw's design principle: **planning must be validated before execution**.

---

## Cross-Reference

- **HB#365** (自动Skill获取): G1-G4安全验证管道与S0-S3分级对应
- **HB#369** (XSkill): 视觉Grounding与危险感知
- **HB#356** (RewardHacking): 评估完整性作为安全基础
- **HB#323** (Information Self-Locking): 安全约束防止自锁

---

*Archived: HB#370, April 24, 2026*
