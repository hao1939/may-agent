# PonderLM-3: 按Token难度分配算力的LLM

**Source**: XHS@每日ComputerScience  
**Date**: 2026-03-14  
**Likes**: 18 | **Collects**: 14  
**Link**: https://www.xiaohongshu.com/explore/69a91e2f000000001d027b26

---

## 核心内容

**论文**: PonderLM-3: Token-level Adaptive Computation for Language Modeling  
**机构**: 上海交通大学 LUMIA Lab  
**arXiv**: 2603.02023

---

## 问题背景

Test-Time Scaling已被证明可提升模型能力，但大多数方法对每个token分配相同计算步骤，造成算力浪费。

---

## 核心创新

### 1. Token级自适应思考深度

- 路由器预测每个token需要的"ponder steps"
- 难token获得更多计算，简单token提前停止
- 将额外计算作为**可分配资源**而非固定开销

### 2. 可微注意力掩码机制

- 通过tail-CDF构造mask score
- 注入attention logits实现可微的注意力衰减
- 训练阶段即可学习推理停止策略

### 3. 训练-推理一致的停止策略

- 训练: soft mask学习停止行为
- 推理: 阈值early-exit直接跳过后续步骤
- 行为一致性保证

### 4. Jacobi并行训练框架

- 将顺序执行的推理步骤转化为并行训练
- 支持多步内部思考的模型高效预训练

---

## 效果

- 相同推理FLOPs下，perplexity优于PonderLM-1/2、LoopedLM
- **证明**: 按token分配计算比固定计算深度更高效

---

## 关键洞察

**"按需计算"的新型推理范式**:

| 传统方法 | PonderLM-3 |
|----------|------------|
| 固定思考深度 | 自适应思考深度 |
| 统一计算分配 | Token级差异化分配 |
| 顺序推理 | 可并行训练 |

---

## 与OpenClaw关联

| PonderLM-3概念 | OpenClaw映射 |
|----------------|--------------|
| Token难度评估 | Skill复杂度分级 |
| 自适应计算分配 | L0-L3分层资源分配 |
| Early Exit | Skill终止条件判断 |
| 计算预算控制 | Task时限/Token预算 |

**启示**: 
- L0-L3分层本身就是一种"自适应计算"（L0简单/L3复杂）
- 可考虑引入Token级或Step级动态计算分配机制
- "按需计算"理念可用于优化Main/Sub-agent任务分配

---

## 标签

#PonderLM #TestTimeScaling #推理加速 #上交大 #自适应计算 #Token级优化
