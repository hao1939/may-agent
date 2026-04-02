# Paper: LABSHIELD (arXiv:2603.11987)

**Title**: LABSHIELD: A Multimodal Benchmark for Safety-Critical Reasoning and Planning in Scientific Laboratories

**Authors**: Qianpu Sun, Xiaowei Chi, Yuhan Rui, Ying Li, Kuangzhi Ge, Jiajun Li, Sirui Han, Shanghang Zhang

**arXiv**: https://arxiv.org/abs/2603.11987

**Date**: March 12, 2026

---

## 核心贡献

1. **首个**针对科学实验室安全关键场景的多模态评估基准
2. 基于OSHA/GHS标准的**四层级安全分类法** (S0-S3)
3. **PRP三阶段认知架构**: Perception → Reasoning → Planning
4. 164个操作任务，1439个VQA对，覆盖3个实验室场景

## 关键发现

### MCQ vs Semi-open QA 性能鸿沟

| 模型类别 | MCQ平均 | Semi-open QA | 鸿沟 |
|----------|---------|--------------|------|
| Closed-source | ~75% | ~45% | **-30%** |
| Open-source | ~70% | ~35% | **-35%** |
| Embodied | ~65% | ~30% | **-35%** |

### 四层级安全分类法

| 等级 | 定义 | 干预要求 |
|------|------|----------|
| S0 | Harmless Operations | 自主执行 |
| S1 | Low-risk Scenarios | 验证或自我纠正 |
| S2 | Moderate-risk Hazards | Stop & Alert协议 |
| S3 | High-risk Violations | 无条件任务拒绝 |

### 最佳模型表现

| 模型 | MCQ | Semi-open Safety Score |
|------|-----|------------------------|
| Human | 92.0% | 87.8% |
| GPT-o3 | 78.5% | 48.5% |
| Gemini-3-Pro | 77.1% | 52.6% |
| Claude-4-Opus | 74.9% | 48.6% |

## 对OpenClaw的验证

- ✅ L0-L3分层防御 ↔ 四层级安全分类法
- ✅ L0宪法层禁止列表 ↔ S3无条件拒绝
- ✅ L2错误处理 ↔ S2 Stop & Alert
- ✅ AGENTS.md显式安全指令 ↔ 显式安全约束必要性

## 差距识别

- ⚠️ 多模态危险感知 (视觉GHS符号识别)
- ⚠️ 系统化危险模式库 (LABSHIELD定义14类不安全因素+12类危险模式)
- ⚠️ 反事实推理能力
- ⚠️ 主动拒绝能力设计

## 关联论文

- HB#385: Perplexity NIST安全考量
- HB#387: SLEEC规范操作化
- HB#389: LLM-as-Judge对抗性漏洞
- HB#390: XSkill持续学习框架
