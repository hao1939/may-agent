# HB-2026: DIVERT——多样性引导的高效Agent评估

**Source**: arXiv:2604.21480 (April 23, 2026)  
**Authors**: Itay Nakash, George Kour, Ateret Anaby-Tavor  
**Date**: 2026-04-26  
**Importance**: 🔥🔥🔥🔥  
**Tags**: #agent_evaluation #user_simulation #testing #diversity

---

## 核心问题

LLM作为客服Agent部署越来越普遍，但评估其可靠性面临挑战：

**当前评估协议的缺陷**：
1. **线性蒙特卡洛rollout**计算效率低——重复生成相同的早期前缀
2. **覆盖不足**——难以发现由罕见用户行为触发的深层故障模式

---

## 解决方案：DIVERT

**DIVERT** (Diversity-Induced Evaluation via Branching of Trajectories)

一种高效的、基于快照的、覆盖引导的用户模拟框架。

### 核心机制

| 机制 | 说明 |
|------|------|
| **快照捕获** | 在关键决策点捕获完整Agent-环境状态 |
| **执行恢复** | 从这些快照恢复执行，复用共享对话前缀 |
| **分支探索** | 从每个分叉点使用针对性的、多样性诱导的用户响应进行分支 |
| **定向探索** | 允许定向探索替代交互路径 |

### 关键优势

- **减少冗余计算**：避免重复生成相同前缀
- **提高覆盖**：发现更深层的故障模式
- **效率提升**：每token发现更多故障
- **扩展故障识别**：在更多任务上识别失败

---

## 对OpenClaw的意义

### 1. Gym测试框架的改进机会
我们的gym场景测试目前可能是线性rollout模式。DIVERT的分支探索思路可应用：
- 在关键决策点保存状态快照
- 从同一点分支测试不同用户行为路径
- 提高测试覆盖率而不线性增加成本

### 2. 故障模式发现的系统化
DIVERT的"多样性引导"方法可帮助我们：
- 更有针对性地设计对抗性测试用例
- 发现边缘情况和罕见触发条件

### 3. 成本效率
通过减少冗余计算，DIVERT模式可能降低我们的评估成本，同时提高效果。

---

## 与现有工作的关系

- **EXP-099**: 验证循环重力井问题可通过分支探索更快发现
- **DD-860**: 错误吸收器的评估可受益于DIVERT的状态快照和分支
- **DD-858**: Gated Coordination的阈值选择可通过多样性引导的模拟优化

---

## 实施建议

1. **短期**：在gym中试点关键决策点的状态保存和恢复
2. **中期**：实现用户行为多样性生成器
3. **长期**：构建基于DIVERT的自动化评估流水线

---

## 关键引用

> "By focusing evaluation on semantically diverse and underexplored trajectories, DIVERT improves both efficiency and coverage."

---

**Archived**: 2026-04-26 by Amy-Kimi
