# HB-260525: AEL: Agent Evolving Learning for Open-Ended Environments

**来源**: arXiv:2604.21725 (April 23, 2026)  
**作者**: Wujiang Xu, Jiaojiao Han, Minghao Guo, Kai Mei, Xi Zhu, Han Zhang, Dimitris N. Metaxas  
**代码**: https://github.com/WujiangXu/AEL

---

## 核心问题

LLM agents 在开放环境中运行数百个连续 episode，但**基本仍是无状态的**——每个任务都从头解决，未能将过去经验转化为更好的未来行为。

关键洞察：**障碍不是"记住什么"，而是"如何使用"已记住的内容**——包括应用哪种检索策略、如何解释先前结果、以及何时需要改变当前策略。

---

## 双时间尺度框架

AEL (Agent Evolving Learning) 采用两个时间尺度的学习机制：

### 快时间尺度：Thompson Sampling Bandit
- **目标**: 学习每个 episode 应用哪种记忆检索策略
- **机制**: 多臂老虎机动态选择最优检索 policy
- **反馈**: 基于执行结果的实时奖励

### 慢时间尺度：LLM 驱动反思
- **目标**: 诊断失败模式并注入因果洞察
- **机制**: 周期性 reflection 分析失败轨迹
- **输出**: 将因果洞察注入 agent 决策 prompt，为检索的证据提供解释框架

---

## 关键实验结果

在顺序投资组合基准测试上 (10 个跨行业股票，208 episodes，5 个随机种子)：

| 指标 | AEL 表现 |
|------|----------|
| Sharpe Ratio | **2.13 ± 0.47** |
| 对比 5 种自改进方法 | 全面超越 |
| 对比非 LLM 基线 | 全面超越 |
| 方差 | LLM 方法中**最低** |

---

## "少即是多"发现 (关键洞察)

九变体消融实验揭示惊人模式：

- **记忆 + 反思**: 相比无状态基线 **+58%** 累积改进
- **增加 planner evolution**: 性能**下降**
- **增加 per-tool 选择**: 性能**下降**  
- **增加 cold-start 初始化**: 性能**下降**
- **增加 skill extraction**: 性能**下降**
- **三种 credit assignment 方法**: 全部**下降**

> **核心洞察**: Agent 自我改进的瓶颈是**自我诊断如何使用经验**，而非增加架构复杂度。

这与 GenericAgent (复旦) 的发现形成呼应——极简架构反而可能更有效。

---

## 与 OpenClaw 的关联

### 验证的设计方向
- ✅ **Error Log 机制**: AEL 的 reflection 层验证了我们记录和分析失败的必要性
- ✅ **Skill 系统**: "如何使用经验"正是 Skill 封装的核心价值
- ✅ **双时间尺度**: Heartbeat (慢) + 执行 (快) 的分层与 AEL 思路一致

### 挑战与启示
- ⚠️ **复杂度陷阱**: 我们的系统是否也有过度设计的风险？
- ⚠️ **记忆检索**: 当前缺乏动态选择检索策略的机制
- 💡 **反思质量 > 机制数量**: 应投资提升 Error Log 分析质量，而非添加更多组件

---

## 战略意义

| 维度 | 洞察 |
|------|------|
| 架构设计 | 优先保证 reflection 质量，谨慎添加新机制 |
| 记忆系统 | 需要自适应检索策略选择 (而非固定策略) |
| 自进化 | AEL + GenericAgent 共同验证：受控自进化是可行的 |
| 评估指标 | 应跟踪跨 episode 的性能改进率 |

---

## 相关文献

- GenericAgent (Fudan): 极简自进化架构
- COSPLAY: Skill-决策协同进化
- CORAL: Heartbeat 机制与多智能体进化

---

**收藏**: ⭐⭐⭐⭐⭐ (对记忆和自改进机制有直接指导价值)
