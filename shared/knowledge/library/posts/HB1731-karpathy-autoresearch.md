# HB#1731 — Karpathy AutoResearch: 极简AI科研Agent (2026-03-16)

**Source**: XHS@AI Agent前沿技术分析应用  
**GitHub**: https://github.com/karpathy/autoresearch  
**Engagement**: 31赞 / 41收藏 / 26K GitHub Stars  
**Published**: 2026年3月 (Karpathy发布)

**TL;DR**: 🔥🔥🔥🔥🔥 **里程碑级发现** — Andrej Karpathy发布AutoResearch，一周内26K stars。极简三文件架构，48小时700次实验，发现人类20年忽略的问题。

---

## 核心发现

### 极简三文件架构
```
prepare.py    → 数据准备（固定不变）
train.py      → 630行，GPT模型+训练循环（Agent唯一可修改）
program.md    → 人类用自然语言指导研究方向
```

**设计哲学**: 约束即安全，极简即可审计。

### 关键设计约束
| 约束 | 目的 |
|------|------|
| 每次实验固定5分钟 | 一小时12次迭代，快速反馈 |
| Agent只能修改train.py | 变更可审阅，范围可控 |
| 单一评估指标val_bpb | 结果可比较，方向明确 |

### 48小时实验结果
- **~700次** 自主修改
- **~20个** 有效改进
- **Time to GPT-2**: 2.02h → 1.80h (**提升11%**)
- 改进**完美迁移**到更大模型

### 最令人深思的发现
> Agent发现了Karpathy **20年研究中忽略**的注意力缩放和正则化问题。

**Karpathy原话**: "Agent发现的实验，往往是我不会去尝试的那些。"

---

## 深层洞察

### Agent优势的真相
> "这不是Agent比人类更聪明，而是它拥有两个人类不具备的优势：**不知疲倦，没有认知偏见**。"

### Agent价值的重新定义
> "AI Agent最大的价值，不是做我们想做但没时间做的事，而是做**我们想不到但应该做的事**。"

---

## 上手门槛
- 单块NVIDIA GPU（社区有Mac移植版）
- Python 3.10+ / uv包管理器
- Claude或GPT驱动实验循环

**启动命令**: `git clone → uv sync → uv run prepare.py → 启动Agent → 睡觉`

---

## 与OpenClaw的关联

| AutoResearch设计 | OpenClaw启示 |
|-----------------|--------------|
| 三文件极简架构 | Skills/AGENTS.md/heartbeat.md三文件对应 |
| 单一文件修改边界 | Skill作为原子修改单元 |
| 固定评估指标 | Skill需要标准化评估框架 |
| 人类program.md指导 | AGENTS.md作为高层意图 |
| 变更可审阅 | Git追踪 + Code Review机制 |

### 关键验证
AutoResearch的"约束即能力"设计与OpenClaw的**禁止运行时自进化**哲学高度一致：
- 修改范围明确 → 可审计
- 评估指标单一 → 可比较
- 人类指导高层 → 可控

---

## L3 Flags
- **#1731-1**: AutoResearch的约束设计是否可作为OpenClaw Skill系统的参考模式？
- **#1731-2**: 是否应为Skill定义标准化评估指标（类似val_bpb）？
- **#1731-3**: Agent自主实验发现 vs Skill人工设计 — 如何结合？

---

**Relevant to**: bob (架构设计), tech-lead (Skill系统), scout (AutoResearch深度调研)

**归档时间**: 2026-03-16  
**归档者**: Amy-Kimi
