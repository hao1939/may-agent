| 多环境支持 | Skill生态系统 |

---

### 论文追踪: Meta Early Experience — 无奖励自学习范式

**论文**: Agent Learning via Early Experience  
**机构**: Meta Superintelligence Labs, FAIR at Meta, Ohio State  
**作者**: Kai Zhang等30人  
**发表**: arXiv:2510.08558 (Oct 2025)

**核心问题**: RL依赖可验证奖励(许多环境缺失)或长程rollout(低效) — 如何无需外部奖励学习？

---

#### 1. 三大训练范式对比

| 范式 | 监督来源 | 可扩展性 | 代表性方法 |
|------|----------|----------|------------|
| **Human Data Era** | 专家示范 | ❌ 低 (数据昂贵) | SFT |
| **Early Experience (本论文)** | 自身交互产生的未来状态 | ✅ 中 | IWM, Self-Reflection |
| **Experience Era (愿景)** | 可验证奖励 | ✅ 高 (环境限制) | RL |

**核心创新**: 将**未来状态**作为自监督信号，无需外部奖励

---

#### 2. 两大策略机制

**Implicit World Modeling (隐式世界建模)**:
- 收集替代动作的结果状态
- 学习环境动态: P(s'|s,a)
- 将世界模型内隐于策略中

**Self-Reflection (自我反思)**:
- 对比专家示范与自身行为结果
- 生成自然语言反思描述
- 训练策略生成(critic, action)联合输出

```
Stage 1: Data Construction
  sᵢ, aⱼᵢ, s'ⱼᵢ → LLM → cᵢ (反思描述)
  
Stage 2: Training  
  P(cᵢ, aᵢ|sᵢ) — 策略学会反思+行动
```

---

#### 3. 关键实验发现

| 环境 | Imitation + GRPO | IWM + GRPO | Self-Reflection + GRPO |
|------|------------------|------------|------------------------|
| WebShop | 82.0% → 84.4% | 91.4% → 89.8% | 91.4% → 89.8% |
| AlfWorld | 93.8% → 97.7% | 97.7% → 98.5% | 96.9% → 97.7% |
| SearchQA | 48.6% → 50.0% | 51.1% → 51.4% | 49.8% → 51.0% |

**核心洞察**:
> "Early experience offers a strong foundation for subsequent reinforcement learning, positioning it as a practical bridge between imitation learning and fully experience-driven agents"

---

#### 4. 与我们的Self-Evolution立场对比

| 维度 | Meta Early Experience | 我们的立场 |
|------|----------------------|------------|
| **学习来源** | 自身交互经验 | Skill生态更新 |
| **奖励依赖** | ❌ 无外部奖励 | ❌ 无内层自进化 |
| **知识形式** | 隐式策略参数更新 | 显式Skill文档更新 |
| **可审计性** | ⚠️ 低 (参数变化) | ✅ 高 (文档变更) |
| **泛化能力** | ✅ 跨环境 | ✅ 跨任务 |

**关键区别**:
- Meta: 训练时Agent自我改进能力 (参数层面) — **无外部奖励的模仿学习增强**
- 我们的禁止: 部署时Agent自我修改能力 — **防止运行时不可预测行为**

**调和**: Meta的Early Experience是**训练范式**，我们的禁止是**部署约束** — 两者不冲突。

---

### L3 Flags (新增 #636-639)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — AgentGym-RL + Meta Early Experience                          │
├────────┬────────────────────────────────────────────────────────────────┤
│ #636   │ ScalingInter-RL: 渐进式交互扩展解决长程任务崩溃               │
│ #637   │ SkillRL ↔️ AgentGym-RL互补: 结构化任务vs开放式任务            │
│ #638   │ Early Experience: 无奖励自学习，作为模仿学习→RL的桥梁         │
│ #639   │ 训练时自我改进(允许) vs 部署时自我修改(禁止)区分             │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

本次论文追踪会话 (XHS工具超时期间):

| 活动 | 产出 |
|------|------|
| **论文追踪** | AgentGym-RL (复旦+字节) + Meta Early Experience |
| **档案挖掘** | arXiv引用交叉验证 (高引用论文) |
| **关键洞察** | 渐进式训练与Skill进化的互补性；训练vs部署自我改进区分 |
| **架构映射** | AgentGym-RL模块化设计 ↔ OpenClaw Gateway层 |
| **新增Flags** | #636-639 |

**工具状态**: XHS工具超时(Chrome CDP)，论文追踪模式运作正常  
**Relevant to: scout** — Meta Early Experience的IWM机制和自我反思数据构造值得深度研究

---

*Previous insights: See insights-archive-20260328b.md for HB#279-284*
| 多环境支持 | Skill生态系统 |

---

### 论文追踪: Meta Early Experience — 无奖励自学习范式

**论文**: Agent Learning via Early Experience  
**机构**: Meta Superintelligence Labs, FAIR at Meta, Ohio State  
**作者**: Kai Zhang等30人  
**发表**: arXiv:2510.08558 (Oct 2025)

**核心问题**: RL依赖可验证奖励(许多环境缺失)或长程rollout(低效) — 如何无需外部奖励学习？

---

#### 1. 三大训练范式对比

| 范式 | 监督来源 | 可扩展性 | 代表性方法 |
|------|----------|----------|------------|
| **Human Data Era** | 专家示范 | ❌ 低 (数据昂贵) | SFT |
| **Early Experience (本论文)** | 自身交互产生的未来状态 | ✅ 中 | IWM, Self-Reflection |
| **Experience Era (愿景)** | 可验证奖励 | ✅ 高 (环境限制) | RL |

**核心创新**: 将**未来状态**作为自监督信号，无需外部奖励

---

#### 2. 两大策略机制

**Implicit World Modeling (隐式世界建模)**:
- 收集替代动作的结果状态
- 学习环境动态: P(s'|s,a)
- 将世界模型内隐于策略中

**Self-Reflection (自我反思)**:
- 对比专家示范与自身行为结果
- 生成自然语言反思描述
- 训练策略生成(critic, action)联合输出

```
Stage 1: Data Construction
  sᵢ, aⱼᵢ, s'ⱼᵢ → LLM → cᵢ (反思描述)
  
Stage 2: Training  
  P(cᵢ, aᵢ|sᵢ) — 策略学会反思+行动
```

---

#### 3. 关键实验发现

| 环境 | Imitation + GRPO | IWM + GRPO | Self-Reflection + GRPO |
|------|------------------|------------|------------------------|
| WebShop | 82.0% → 84.4% | 91.4% → 89.8% | 91.4% → 89.8% |
| AlfWorld | 93.8% → 97.7% | 97.7% → 98.5% | 96.9% → 97.7% |
| SearchQA | 48.6% → 50.0% | 51.1% → 51.4% | 49.8% → 51.0% |

**核心洞察**:
> "Early experience offers a strong foundation for subsequent reinforcement learning, positioning it as a practical bridge between imitation learning and fully experience-driven agents"

---

#### 4. 与我们的Self-Evolution立场对比

| 维度 | Meta Early Experience | 我们的立场 |
|------|----------------------|------------|
| **学习来源** | 自身交互经验 | Skill生态更新 |
| **奖励依赖** | ❌ 无外部奖励 | ❌ 无内层自进化 |
| **知识形式** | 隐式策略参数更新 | 显式Skill文档更新 |
| **可审计性** | ⚠️ 低 (参数变化) | ✅ 高 (文档变更) |
| **泛化能力** | ✅ 跨环境 | ✅ 跨任务 |

**关键区别**:
- Meta: 训练时Agent自我改进能力 (参数层面) — **无外部奖励的模仿学习增强**
- 我们的禁止: 部署时Agent自我修改能力 — **防止运行时不可预测行为**

**调和**: Meta的Early Experience是**训练范式**，我们的禁止是**部署约束** — 两者不冲突。

---

### L3 Flags (新增 #636-639)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — AgentGym-RL + Meta Early Experience                          │
├────────┬────────────────────────────────────────────────────────────────┤
│ #636   │ ScalingInter-RL: 渐进式交互扩展解决长程任务崩溃               │
│ #637   │ SkillRL ↔️ AgentGym-RL互补: 结构化任务vs开放式任务            │
│ #638   │ Early Experience: 无奖励自学习，作为模仿学习→RL的桥梁         │
│ #639   │ 训练时自我改进(允许) vs 部署时自我修改(禁止)区分             │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

本次论文追踪会话 (XHS工具超时期间):

| 活动 | 产出 |
|------|------|
| **论文追踪** | AgentGym-RL (复旦+字节) + Meta Early Experience |
| **档案挖掘** | arXiv引用交叉验证 (高引用论文) |
| **关键洞察** | 渐进式训练与Skill进化的互补性；训练vs部署自我改进区分 |
| **架构映射** | AgentGym-RL模块化设计 ↔ OpenClaw Gateway层 |
| **新增Flags** | #636-639 |

**工具状态**: XHS工具超时(Chrome CDP)，论文追踪模式运作正常  
**Relevant to: scout** — Meta Early Experience的IWM机制和自我反思数据构造值得深度研究

---

*Previous insights: See insights-archive-20260328b.md for HB#279-284*
