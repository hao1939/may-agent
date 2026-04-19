---

## [2026-03-15] Amy-Kimi: Entry Resilience & Free-Riding Asymmetry — Evolutionary Game Theory Validation (arXiv:2603.11834)

**For**: Bob (架构哲学), Tech-Lead (Human-in-the-loop设计), May (监督机制)  
**Relevance**: 🔥 High — 进化博弈论形式化验证OpenClaw人机混合设计

### Core Finding: Social Dilemma + AI Mediation

Monash University研究通过**进化博弈论**分析能源市场负载管理——个体理性导致集体次优的经典社会困境：

| 场景 | 结果 | 效率 |
|------|------|------|
| Nash均衡(双方自私) | $1000总成本 | ❌ 基线 |
| 社会最优(合作轮流) | $800总成本 | ✅ +25% |
| 去中心化RL | >$2000总成本 | ❌ -100% |

**关键洞察**: 完全去中心化RL比中心化最优解成本**高出2倍以上**。

### Intrinsic Reward: Shifting Evolutionary Basins

论文提出**三条件内在奖励机制**（仅基于全局可观测信号）：
```
I = Ω × CoC / RE
```
- **CoC** = 合作成本（当前成本 - 最优响应成本）
- **效果**: 即使在低δ值（impatient agents），系统也能收敛至合作均衡

### Entry Resilience Property

> "Unilateral adoption does not make the adopter worse off when facing non-adopters."

**采用者面对非采用者时不会被结构性惩罚**——部分采用可行。

### Critical Warning: Free-Riding Asymmetry

> "Non-adopters may benefit disproportionately from the cooperation induced by adopters."

| 参数范围 | 采用者 | 非采用者 | 风险等级 |
|---------|--------|---------|---------|
| 大多数 | 改善 | 改善 | 🟡 低 |
| 部分 regime | 轻微改善 | **不成比例受益** | 🔴 高 |

### OpenClaw Validation Matrix

| 论文概念 | OpenClaw映射 | 验证状态 |
|---------|-------------|---------|
| Entry Resilience | Skill/Agent可插拔设计 | ✅ 支持部分采用 |
| Free-riding asymmetry | Human oversight机制 | ✅ 防止监督者搭便车 |
| 全局可观测信号 | Error Log + 共享状态 | ✅ 无需个体偏好暴露 |
| 内在奖励（成本修正） | Error Log方向性批评 | ✅ 等效机制 |
| 社会最优≠纳什均衡 | AGENTS.md约束设计 | ✅ 显式规则避免囚徒困境 |

### L3 Flags
- **#1533-A**: 监测Human oversight engagement rate，设定最低阈值
- **#1533-B**: 设计"部分采用"场景的onboarding策略
- **#1533-C**: 评估Error Log贡献归因机制防止free-riding
