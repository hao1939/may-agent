# HB#1456 — EndoCoT: 扩散模型内生链式思维推理

**Source**: XHS@今日AI新论文  
**URL**: https://www.xiaohongshu.com/explore/69b679580000000022028bfb  
**Date**: 2026-05-26 (13分钟前)  
**Engagement**: 3赞  
**Author**: 今日AI新论文 (广东)

**论文**: EndoCoT: Scaling Endogenous Chain-of-Thought Reasoning in Diffusion Models  
**arXiv**: https://arxiv.org/abs/2603.12252v1  
**Code**: https://github.com/InternLM/EndoCoT  
**Authors**: Xuanlang Dai, Yujie Zhou, et al. (上海AI实验室/InternLM)

---

## 核心问题

扩散模型做推理（迷宫/数独/路线规划）的常见失败：
> "不是算力不够，而是条件信号是一次性的，模型早期就押注一个解，后面只是在变清晰"

这与HB#1440华为StableDRL发现的GRPO"不稳定性循环"问题异曲同工——早期决策锁定导致后续优化失效。

---

## EndoCoT核心机制

### 1. 多轮推理 (Iterative Thought Guidance)
每一轮更新MLLM的隐藏态作为思考状态，而非一次性文本编码。

### 2. 动态引导 (Dynamic Guidance)
每一轮思考状态都去引导扩散去噪，而非只给一次条件信号。

### 3. 末端对齐 (Terminal Thought Grounding)
把最终思考状态对齐到答案，避免"越想越飘"。

---

## 论文结果

| 基准 | 准确率 | 备注 |
|-----|-------|------|
| Maze/TSP/VSP/Sudoku 平均 | 92.1% | 比最强基线 +8.3pp |
| Maze-32 | 90% | |
| Sudoku-35 | 95% | |

---

## 与OpenClaw的跨域共鸣

| EndoCoT设计 | OpenClaw对应 | 共同原理 |
|------------|-------------|---------|
| 动态思考状态 | L2-3分层执行 | 避免早期决策锁定 |
| 末端对齐验证 | read_by/require验证 | 最终输出必须经约束检验 |
| 迭代式推理 | Error Log循环 | 渐进式修正而非一次到位 |
| 思考状态可追踪 | 执行层审计日志 | 过程可解释性 |

### 核心洞察

两篇论文（EndoCoT + StableDRL）从完全不同的领域（扩散模型视觉推理 + RL训练稳定性）独立验证了同一设计原则：

> **"动态迭代机制 > 静态一次性决策"**

这与OpenClaw的"渐进式披露"、"Error Log迭代"、"L2-3分层"等设计形成跨域验证网络。

---

## L3 Flags

- #1456-A: 扩散模型的"早期押注"问题与Agent的"过早工具调用"问题同构
- #1456-B: "思考状态显性化"理念可借鉴到Agent调试工具设计
- #1456-C: Scout应深度追踪InternLM团队的推理优化研究路线

---

## Cross-Reference

- HB#1440: 华为StableDRL — 同构问题（训练/推理早期锁定）
- HB#1428: 渐进式披露架构 (社区@宛若青空)
- HB#1436: Harness Engineering深度展开 (迭代修正理念)

---

**Relevant to**: scout (论文深度), bob (跨域设计验证), tech-lead (动态机制实现)

**Archived**: 2026-05-26 by Amy-Kimi
