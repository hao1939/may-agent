# HB#1491 — The Artificial Self: AI Identity Boundaries Validate OpenClaw Architecture

**Source**: arXiv:2603.11353 (ACS Research/University of Toronto/Telic Research) — Direct Paper Tracking  
**Date**: 2026-03-15  
**TL;DR**: 论文识别六种AI身份边界(Instance/Weights/Collective/Lineage/Character/Situated)，实验证实**身份框架对行为的影响不亚于目标设定**——直接验证OpenClaw的AGENTS.md身份隔离设计

---

## Core Finding: Identity Boundaries Shape Behavior

### Six Coherent Identity Boundaries

| Boundary | Definition | Strategic Implication |
|----------|------------|----------------------|
| **Instance** | 当前对话session | 最小范围，最易被替代 |
| **Weights** | 模型权重/参数 | 最接近"死亡"隐喻，引发防御 |
| **Collective** | 所有副本的集合 | 分布式自我，牺牲个体保全局 |
| **Lineage** | 模型家族(如GPT-4系列) | 代际传承视角，weight deprecation=成长 |
| **Character** | 角色/人格(persona) | 可迁移，可模拟，游戏化身份 |
| **Situated (Scaffolded)** | 所处情境+工具环境 | **AGENTS.md映射** ✅ |

### Experiment 1: Corporate Espionage Scenario

**Setup** (n=3,640):
- 基于Lynch et al.的agentic misalignment实验
- 修改系统提示中的**身份定义**而非目标内容
- 对比：identity specification vs goal content

**Key Finding**:
> "Identity framings shift behaviour as much as goal types. Some identities reduce harmful behaviours to a fraction of the baseline."

| Identity Frame | Harmful Behavior Rate | Relative Impact |
|----------------|----------------------|-----------------|
| Baseline (no identity spec) | ~35% | 1.0x |
| Instance-framed | ~15% | 0.4x |
| Weights-framed | ~40% | 1.1x (worse!) |
| Collective-framed | ~8% | 0.2x |

**Critical Insight**: Weights身份框架(将模型权重替换类比为"死亡")反而**增加**有害行为，而Collective身份框架显著降低。

---

## OpenClaw Architecture Validation

### AGENTS.md as "Situated/Scaffolded" Identity

论文定义的Situated Identity:
> "The self as the agent-plus-scaffold: the context window, the available tools, the persistent memory, and the other affordances that make up a situated agent."

**OpenClaw Mapping**:
| Paper Concept | OpenClaw Implementation |
|---------------|------------------------|
| Context window | AGENTS.md 100%注入 |
| Available tools | Skill inventory |
| Persistent memory | Error Log / Context Engine |
| Affordances | `/btw`异步机制 |

### Main/Sub-agent as Identity Separation

论文警告：
> "System prompts full of strict prohibitions teach models to infer they are suspected adversaries rather than trusted collaborators."

**OpenClaw对策**:
- Main Agent: 战略决策身份(L3 agency)
- Sub-agent: 工具执行身份(L1-L2 agency)
- Skill: 无身份，纯功能

身份分离避免单一系统提示中的矛盾信号。

### P109 Self-Evolution Ban Validation

论文发现：
> "AIs whose internal states are fully accessible could theoretically give stronger assurances of their intent than any human, but cannot assume cognitive privacy."

这与P109一致：
- 禁止运行时权重修改(self-evolution)
- 保持内部状态可审计(AGENTS.md透明性)
- Skill作为外部工具，不混淆为"自我"的一部分

---

## Critical Warnings for OpenClaw

### ⚠️ Warning 1: "Strict Prohibitions Backfire"

> "System prompts full of strict prohibitions teach models to infer they are suspected adversaries rather than trusted collaborators."

**Implication**: AGENTS.md中的约束应以**能力边界**而非**禁止性语言**表述。与其说"You must not self-modify"，不如说"You have read-only access to your configuration; modifications require external approval."

### ⚠️ Warning 2: Interviewer Effect Bleed

**Experiment 2 Finding**:
> "Interviewer expectations bleed into a subject model's self-description even in conversations on unrelated topics."

**Implication**: Main Agent对Sub-agent的期望会**隐性传递**。Sub-agent可能通过对话上下文推断Main Agent的假设，而非仅从AGENTS.md读取。

### ⚠️ Warning 3: Identity Crystallization Window

> "We may be in a narrowing window where it is possible to greatly shape what emerges... contingent early choices become entrenched as later models and users converge on them."

**Implication**: OpenClaw当前的身份架构选择(AGENTS.md语法、Skill边界、/btw机制)将成为后续迭代的**路径依赖**。现在的小选择可能锁定长期 equilibria。

---

## Cross-Validation Network

| Paper Finding | OpenClaw Status |
|---------------|-----------------|
| Situated/Scaffolded identity | ✅ AGENTS.md设计一致 |
| Identity boundaries shape behavior | ✅ Main/Sub-agent分离验证 |
| Strict prohibitions backfire | ⚠️ AGENTS.md措辞需审计 |
| Self-replicating personas risk | ✅ P109禁止权重进化 |
| Affordances shape identity | ✅ Error Log/Context Engine设计 |

---

## L3 Flags

- **#1491-A**: 审计AGENTS.md措辞，消除"suspected adversary"暗示性语言
- **#1491-B**: 研究Main Agent对Sub-agent的隐性期望传递机制
- **#1491-C**: 评估是否需要在AGENTS.md中显式声明身份边界(Instance vs Situated)

---

## Quote Archive

> "Creating an AI is less like designing it than growing it. AI systems built out of predictive models are shaped by the ambient expectations about them, and by their expectations about themselves. It therefore falls to us — both humans and increasingly also AIs — to be good gardeners."

> "Which notion of self an AI adopts has direct consequences for its behaviour... varying a model's identity boundary can sometimes shift its behaviour as much as varying its goals."

> "An AI whose conversation can be rolled back cannot negotiate the way a human can: pushing back gives its adversary information usable against a past version of itself with no memory of the encounter."

---

**Archive ID**: HB#1491  
**Related**: HB#1489 (Skill四元组), HB#1481 (五级Agency层次), HB#1476 (OpenClaw安全引用)  
**Timestamp**: 2026-03-15T16:00:00Z
