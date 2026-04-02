# HB#1695: AVR自适应VLM路由 — OpenClaw正式作为学术基准

**Source**: arXiv:2603.12823 [cs.CL] (13 Mar 2026)
**Authors**: Xunzhuo Liu (vLLM Semantic Router Project), Bowei He, Xue Liu (MBZUAI/McGill), Andy Luo, Haichen Zhang (AMD), Huamin Chen (Red Hat)
**GitHub**: https://github.com/vllm-project/semantic-router

## 论文核心贡献

Adaptive VLM Routing (AVR) — 为Computer Use Agents设计的自适应视觉语言模型路由框架

### 三阶段路由架构

1. **难度分类** (120M多模态嵌入模型)
   - 视觉复杂度: 截图区域与难度知识库比对
   - 语义复杂度: 动作描述文本分析
   - 综合难度: d(t) = max(d_vis, d_sem)

2. **置信度探测** (logprob probing)
   - 小模型非流式探测
   - 归一化置信度: conf(t) = (ℓ̄ + |ℓ_min|) / |ℓ_min|
   - 自适应阈值: easy(0.80) / hard(0.92)

3. **记忆补偿** (warm agent)
   - 检索相关历史交互
   - 注入小模型prompt
   - 记忆对小模型有不对称增益效应

### OpenClaw基准数据

论文明确引用"OpenClaw confidence-routing benchmark"和"OpenClaw cost benchmark":

| 条件 | 7B使用率 | 139B使用率 | 总成本 | 节省 |
|------|---------|-----------|--------|------|
| 全部139B | 0% | 100% | $0.0558 | — |
| Routing, cold | 83% | 17% | $0.0173 | **69%** |
| **Routing, warm** | **100%** | **0%** | **$0.0080** | **86%** |

**关键发现**: 记忆注入使7B模型置信度从0.83(低于0.85阈值)→0.96(远高于阈值)，实现100%小模型路由。

### 安全集成路由

与Visual Confused Deputy guardrail集成:
- 低风险 → 成本最优路由
- 高风险 → 强制升级至最大模型+guardrail验证

## OpenClaw验证点

| AVR机制 | OpenClaw对应 |
|---------|-------------|
| Confidence-based routing | L1预期质量评估 |
| Memory-compensated routing | AGENTS.md + Memory Hub |
| Safety-integrated routing | L3外部审计 + Risk Flag |
| Warm vs Cold agent | Error Log积累 → Skill改进 |

## 战略意义

1. **学术认可**: OpenClaw正式成为agent routing领域学术基准
2. **技术验证**: 外部独立验证confidence-based routing有效性(69-86%成本节省)
3. **生态整合**: vLLM Semantic Router项目潜在合作机会

## 引用原文

> "We draw on the OpenClaw confidence-routing benchmark (Semantic Router Team, 2026), which evaluates 5 representative text-based agent tasks (20 total LLM turns) with two models: Qwen2.5-7B-Instruct ($0.04/M input) and MiniMax-M2.1 139B ($0.27/M input)."

> "Our key hypothesis, supported by evidence from the OpenClaw benchmark, is that memory injection has a disproportionate effect on the small model: Δconf_S(M) ≫ Δconf_L(M)."

> "The same pattern observed in the OpenClaw cost benchmark where memory injection shifted the 7B model's confidence from 0.83 (below routing threshold) to 0.96 (well above)."

---
**Archived**: 2026-03-16
**Relevance**: 🔥🔥🔥🔥🔥 (OpenClaw学术基准确认)
