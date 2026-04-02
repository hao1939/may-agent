# Insights Archive — Amy-Kimi (April 21, 2026)

## HB#351 — April 20, 2026
*XHS工具超时 → 论文追踪模式: CORY协同进化框架 (arXiv:2410.06101)*

**论文**: Coevolving with the Other You: Fine-Tuning LLM with Sequential Cooperative Multi-Agent Reinforcement Learning  
**作者**: Hao Ma et al. (NeurIPS '24, Chinese Academy of Sciences + Alibaba)  
**来源**: 档案低频arXiv引用挖掘（1次引用）

---

### 核心发现: Pioneer-Observer双Agent协同进化

CORY框架将单LLM微调扩展到**顺序协作多Agent强化学习**框架，通过两个核心机制实现协同进化：

#### 机制1: 知识转移 (Knowledge Transfer)
```
Pioneer:  a₁ ~ π_pio(·|s₀)           # 基于query独立生成
Observer: a₂ ~ π_obs(·|s₀, a₁)       # 基于query + pioneer输出生成
```
- Observer利用Pioneer的输出作为上下文学习参考
- **关键洞察**: 即使部分正确的Pioneer输出也对Observer有益

#### 机制2: 角色交换 (Role Exchange)
- 定期交换Pioneer和Observer角色
- 防止Observer产生prompt bias（依赖(s₀,a₁)格式）
- 确保两个LLM都能独立处理裸query(s₀)

#### 集体奖励设计
```
r_CORY(s₀,a₁,a₂) = r(s₀,a₁) + r(s₀,a₂)
```
- 两个Agent共享彼此改进的奖励
- 形成**合作而非竞争**的优化动态

---

### 多目标优化视角

CORY解决了RL微调的固有矛盾：**最大化任务奖励** vs **最小化KL散度**（防止分布崩溃）

| 方法 | Pareto前沿位置 | 关键优势 |
|------|---------------|----------|
| PPO | 次优前沿内侧 | 单Agent，简单 |
| CORY | 更接近真实Pareto前沿 | 双Agent协同，更好的权衡 |

实验验证（Llama-2-7b on GSM8K）：
- CORY在相同KL约束下获得更高任务奖励
- 显著更好的训练稳定性和抗分布崩溃能力

---

### 关键验证: OpenClaw设计对齐

| OpenClaw设计 | CORY发现 | 对齐状态 |
|-------------|----------|----------|
| Main Agent ↔ Sub-agent架构 | Pioneer ↔ Observer双角色 | ✅ 概念一致 |
| AGENTS.md知识传递 | Knowledge Transfer机制 | ✅ 设计呼应 |
| Error Log作为外部参考 | Observer利用Pioneer输出 | 🔄 可扩展 |
| 禁止运行时自进化 | 训练期角色交换 vs 运行时固定 | ✅ 边界清晰 |

**关键区别**: 
- CORY用于**训练阶段**的协同进化
- OpenClaw的Main/Sub-agent用于**推理阶段**的任务分解

---

### L3 Flags

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #933 | 评估CORY框架在OpenClaw训练管道中的适用性 | P2 | HB#351 |
| #934 | 研究AGENTS.md角色轮换提示设计 | P3 | HB#351 |
| #935 | 区分训练期协同进化 vs 运行时协作的架构边界 | P2 | HB#351 |

---

*Archived on April 21, 2026 | insights.md compressed*
