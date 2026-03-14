# Paper Archive: RLHI — RL from Human Interaction (arXiv:2509.25137)

**论文**: The Era of Real-World Human Interaction: RL from User Conversations  
**团队**: FAIR at Meta + Johns Hopkins University  
**作者**: Chuanyang Jin, Jing Xu, Bo Liu, Leitian Tao, Olga Golovneva, Tianmin Shu, Wenting Zhao, Xian Li, **Jason Weston**  
**arXiv**: https://arxiv.org/abs/2509.25137  
**日期**: September 29, 2025  
**档案引用**: 2次

---

## 核心命题

> "To achieve continual model improvement and multifaceted alignment, future models must learn from natural human interaction."

当前对话模型依赖预标注的、专家生成的人类反馈进行对齐。RLHI提出从**真实用户对话**中直接学习的范式。

---

## 两种互补方法

### 1. RLHI with User-Guided Rewrites

**机制**: 基于用户的自然语言后续响应修订不满意的模型输出，将修订版与原版配对进行偏好学习。

**关键洞察**: 用户通过跟进对话隐式提供反馈，无需显式标注。

### 2. RLHI with User-Based Rewards

**机制**: 使用基于用户长期交互历史（称为**persona**）的奖励模型对候选响应进行排序，生成偏好对。

**核心创新**: Persona-conditioned preference optimization — 将长期用户画像与轮次级别偏好关联。

---

## 人类交互数据的三大特性

| 特性 | 描述 | 与传统数据对比 |
|------|------|----------------|
| **Contextual Grounding** | 源于持续任务流，直接关联用户情境需求和模型先前输出 | 传统: 静态、脱离上下文的标注 |
| **Evolving Distribution** | 反映目标变化、环境变化和偏好适应 | 传统: 固定分布，随时间退化 |
| **Diverse Supervision Signals** | 显式高带宽信号（修正、追问）+ 隐式信号（任务切换、沉默） | 传统: 标量奖励或二元标签 |

---

## 实验结果

| 评估维度 | 结果 |
|----------|------|
| **WildChat UserEval** | 个性化和指令遵循超越强基线 |
| **AlpacaEval 2.0** | User-Based Rewards达**77.9%**长度控制胜率 |
| **推理能力** | User-Guided Rewrites在4个基准上平均准确率从26.5%→31.8% |
| **人类研究** |  corroborates 自动评估趋势 |

---

## 关键消融发现

1. **RL > SFT**: 强化学习优于监督微调
2. **质量过滤关键**: 噪声人类交互数据需要有效过滤
3. **用户指导有益**: 明确的用户后续响应对训练有显著增益
4. **交互多样性重要**: 多样化的交互模式提升泛化

---

## 对我们的意义

### 1. Error Log作为"User-Guided Rewrites"

| RLHI概念 | OpenClaw映射 |
|----------|--------------|
| 用户自然语言后续 | Error Log中的失败反馈 |
| 修订不满意输出 | Skill迭代优化 |
| 偏好学习 | 成功vs失败案例对比 |

**启示**: Error Log机制本质上是"合成User-Guided Rewrites" — 无需真实用户，通过系统内部错误信号实现类似效果。

### 2. Persona与任务上下文的关联

RLHI的persona-conditioned优化可扩展至OpenClaw:
- **任务级persona**: 长期任务历史（类似用户画像）
- **轮次级偏好**: 单次Sub-agent执行偏好
- **关联机制**: 历史任务成功率影响当前Sub-agent选择策略

### 3. 与"Era of Experience"的呼应

论文引用Silver & Sutton (2025)的"Era of Experience"观点:
> "AI systems advance by continually learning from their own interactions with the world."

RLHI将这一观点聚焦于**人机交互维度**，验证了持续学习范式的有效性。

### 4. 数据瓶颈的解决方案

传统对齐面临高质量数据枯竭问题。RLHI证明:
- 真实用户交互是**可扩展的监督源**
- 无需昂贵的专家标注
- 分布更贴近真实使用场景

这与OpenClaw通过实际部署收集Error Log、驱动Skill进化的路线一致。

---

## 关联论文

- **Agentic RL Survey** (arXiv:2509.02547): 多轮RL框架
- **DuCA** (arXiv:2603.01481): 双时间尺度信用分配
- **JustRL** (arXiv:2512.16649): 极简RL训练

---

## L3 Flags

- **#729** — User-Guided Rewrites: 自然语言反馈驱动的偏好学习
- **#730** — Persona-Conditioned Optimization: 长期历史与轮次偏好关联
- **#731** — Contextual Grounding: 情境化反馈优于静态标注
- **#732** — Error Log as Synthetic RLHI: 系统内部错误信号模拟用户反馈

---

*Archived: 2026-04-13*  
*Source: Amy-Kimi Paper Tracing Session (HB#311)*
