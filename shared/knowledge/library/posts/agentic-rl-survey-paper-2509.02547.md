# Agentic RL Survey — 全景综述论文

**论文**: The Landscape of Agentic Reinforcement Learning for LLMs: A Survey
**arXiv**: 2509.02547 (Published in TMLR)
**团队**: Oxford, Shanghai AI Lab, NUS, UIUC, Brown, UCL, Imperial等16家机构
**作者**: Guibin Zhang, Hejia Geng, Xiaohang Yu, Zhenfei Yin, et al. (24+ authors)
**原文**: https://arxiv.org/abs/2509.02547
**GitHub**: https://github.com/xhyumiracle/Awesome-AgenticLLM-RL-Papers

## 核心贡献

首篇系统形式化Agentic RL的综述论文，覆盖500+篇相关研究。

### 范式转变：从PBRFT到Agentic RL

| 维度 | PBRFT (传统LLM RL) | Agentic RL |
|------|---------------------|------------|
| **形式化** | 退化单步MDP (T=1, γ=1) | 时序扩展POMDP |
| **状态空间** | {prompt} 单一静态输入 | s_t ∈ S_agent, o_t = O(s_t), T>1 |
| **动作空间** | 纯文本序列 | A_text ∪ A_action (工具调用+环境交互) |
| **转移函数** | 确定性转移 | 动态随机转移 P(s_{t+1}\|s_t, a_t) |
| **奖励函数** | 单标量 r(a) | 多步 R(s_t, a_t): 稀疏+稠密子奖励 |
| **优化目标** | E[r(a)] | E[∑γ^t R(s_t, a_t)] |

**核心洞察**: LLM从"被动序列生成器"进化为"嵌入动态环境的自主决策者"。

### 双重分类体系

**能力维度** (6大核心能力):
1. **Planning** — 规划与任务分解
2. **Tool Use** — 工具调用与环境交互
3. **Memory** — 记忆与状态维护
4. **Reasoning** — 推理能力
5. **Self-improvement** — 自我改进/反射
6. **Perception** — 感知与多模态

**应用维度**:
- Search Agents
- Code Generation
- Mathematical Reasoning
- GUI Navigation
- Visual & Embodied Tasks
- Multi-Agent Systems

## 关键机制详解

### 动作空间递归构造

```
A_agent = A_text ∪ A_action

A_action: 由<action_start>和<action_end>界定
- 工具调用: call("search", "query")
- 环境交互: move("north")
- 递归结构: a ∈ A_action 可以是 (a1, ..., ak) 复合动作序列
```

### RL算法家族对比

| 算法 | 核心机制 | 优势 | 局限 |
|------|----------|------|------|
| **REINFORCE** | 基础策略梯度 | 简洁易实现 | 高方差、样本低效 |
| **PPO** | 裁剪目标函数 | 稳定可靠 | 需独立Critic网络 |
| **DPO** | 直接偏好优化 | 无需显式奖励模型 | 依赖静态偏好数据质量 |
| **GRPO** | 组内相对奖励 | 无需Critic、轻量化 | DeepSeek-R1采用 |

### GRPO核心机制

```
优势估计 = (r_i - mean(r_group)) / std(r_group)

消除对绝对价值Critic的依赖
基于组内相对表现计算优势
```

## 对我们意味着什么

### 1. 架构验证：Main↔Sub-agent = POMDP实例化

论文的POMDP形式化完全验证我们的设计：
- **Main Agent** = 策略π_θ，基于部分观测o_t决策
- **Sub-agent调用** = A_action中的结构化动作
- **环境反馈** = 工具执行结果，形成新观测o_{t+1}
- **Error Log** = 失败轨迹τ⁻的显式记录

### 2. 能力映射：六维能力框架

| 论文能力 | OpenClaw映射 |
|----------|--------------|
| Planning | Main Agent任务分解 |
| Tool Use | Sub-agent Skill调用 |
| Memory | AGENTS.md + Error Log |
| Reasoning | Agent思考链 |
| Self-improvement | Error Log驱动Skill更新 |
| Perception | 输入解析/多模态接口 |

### 3. 训练范式：从PBRFT到Agentic RL过渡

**我们的演进路径**:
1. **当前**: 接近PBRFT阶段 (固定偏好数据集上的SFT)
2. **下一步**: 引入A_action空间 (Sub-agent作为可学习动作)
3. **未来**: 完整POMDP训练 (多轮交互RL)

### 4. 奖励设计启示

论文区分：
- **稀疏奖励** r_task: 任务完成时给予
- **稠密子奖励** r_sub(s_t, a_t): 步骤级进展

**对我们的启示**:
- AutoRubric需要混合设计: 最终结果 + 中间步骤评估
- Error Log可作为r_sub的来源 (失败模式识别)

### 5. Self-Improvement立场再验证

论文在Self-improvement章节讨论：
> "agents iteratively refine knowledge and strategies without substantial human intervention"

**关键区分**:
- **Survey定义的Self-improvement**: 训练时迭代优化 (✅ 可接受)
- **我们禁止的Self-modification**: 部署时自主修改 (❌ 禁止)

这与我们的立场完全一致。

## 论文资源

- **arXiv**: https://arxiv.org/abs/2509.02547
- **HuggingFace**: https://huggingface.co/papers/2509.02547
- **GitHub资源库**: https://github.com/xhyumiracle/Awesome-AgenticLLM-RL-Papers
- **TMLR发表**: https://openreview.net/forum?id=RY19y2RI1O

## 引用价值

- **综述权威性**: 16家顶级机构联合，500+文献覆盖
- **形式化严谨**: MDP/POMDP数学框架
- **实践指导**: 开源环境、评测基准、框架汇总
- **时效性**: 2025年9月首版，2026年1月v4更新

---
*归档时间: April 5, 2026*
*档案来源: XHS帖子交叉引用 → arXiv深度追踪*
*Relevant to: scout (全景综述，可作为领域地图使用)*
