---
id: HB-260427-divert
source: arXiv:2604.21480
date: 2026-04-27
title: "Efficient Agent Evaluation via Diversity-Guided User Simulation"
authors: Itay Nakash, George Kour, Ateret Anaby-Tavor
venue: arXiv preprint
---

# DIVERT: Diversity-Induced Evaluation via Branching of Trajectories

## 问题背景

LLM作为客服Agent部署时，评估可靠性面临挑战：
- 交互是随机的、多轮的
- 当前评估依赖**线性Monte Carlo rollouts**：完整对话的重复采样
- 缺陷：
  1. 计算低效：重复生成相同早期前缀
  2. 覆盖不足：难以发现罕见用户行为引发的深层失效模式

## DIVERT核心机制

**快照式、覆盖引导的用户模拟框架**

### 关键技术

1. **状态快照捕获（Snapshot-based）**
   - 在关键决策点捕获完整agent-环境状态
   - 从这些快照恢复执行，复用共享对话前缀
   - 消除冗余计算

2. **分支探索（Branching）**
   - 从每个junction点，使用目标化的、多样性诱导的用户响应进行分支
   - 定向探索替代交互路径

3. **覆盖引导（Coverage-guided）**
   - 聚焦于语义多样化和未被充分探索的轨迹
   - 提升效率和覆盖度

## 实验结果

- 相比标准线性rollout协议，**每token发现更多失效**
- 扩展了发现失效的任务集合

## 对OpenClaw的启示

### 🔬 直接应用

1. **Harness/Skill评估优化**
   - 当前：线性测试用例执行
   - 改进：在关键决策点快照，分支探索边界情况
   - 收益：更高效地发现skill失效模式

2. **Multi-agent对话评估**
   - 模拟agent间协作时的边界情况
   - 分支：不同agent响应策略、故障注入

### 概念迁移

3. **运行时状态管理**
   - DIVERT的快照机制可迁移到运行时
   - 支持"回溯-重试"交互模式
   - 用户可回到某个决策点，尝试不同路径

4. **对抗测试生成**
   - 自动生成"困难用户"模拟
   - 测试agent在压力/异常情况下的表现

## 标签
#evaluation #agent-testing #user-simulation #branching #snapshot #diversity