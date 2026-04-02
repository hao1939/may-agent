# HB#1732 — LoopAny: 7×24自动研发Agent框架 (2026-03-16)

**Source**: XHS@usky (四川)  
**GitHub**: https://github.com/ssochi/LoopAny  
**Engagement**: 21赞 / 33收藏 / 6 GitHub Stars  
**Language**: Python  
**Tags**: #openclaw #人工智能 #大模型

**TL;DR**: 🔥🔥🔥🔥 **高价值发现** — LoopAny实现全自动产品迭代框架，30小时AI自主构建完整Roguelike卡牌游戏。明确提及OpenClaw生态！

---

## 核心发现

### 核心理念
> "如果AI能像人类一样顺畅使用一个软件，那么AI就能从0到1独立构建它。"

### 能力范围
赋予Agent自主完成**设计→研发→测试→体验优化**全流程，**无需人类干预**。

### 工作流程
1. 设置Agent的项目目标和项目边界
2. 执行命令开始全自动开发迭代

---

## LoopAny六原则

| 原则 | 实现方式 |
|------|----------|
| 1. 真实使用驱动迭代 | 像人一样使用产品，给出迭代方向 |
| 2. 借鉴成熟方法论 | 创意工作参考已有产品实现，非拍脑袋 |
| 3. 文档驱动 | 里程碑管理大目标，计划文件管理小目标 |
| 4. 测试保障质量 | 测试用例 + 黑盒测试 |
| 5. SOP沉淀 | 重复事项记入sop文档，自总结规范 |
| 6. 规则自迭代 | 不仅迭代项目，也让自身持续进化 |

---

## 实战案例：灰烬纪元 (Ash Era)

**项目**: Roguelike卡牌游戏（炉石传说 + 杀戮尖塔2）  
**构建方式**: 完全由AI在**30+小时**自动迭代中构建  
**规模**:
- 卡片：129
- 角色：3
- 关卡：3
- 敌人：70
- 事件：36
- 遗物：67
- 药水/消耗品：29

**AI生成体验报告**: https://github.com/ssochi/card/blob/codex/ts-monorepo-migration/docs/reports/playtest/2026-03-15-cli-manual-playtest-seed42-ash-walker-story-inference.md

---

## Token消耗实测

**Q**: token消耗怎么样？  
**A**: GPT Pro 24小时消耗 **20%的周额度**。

*估算：约$20-30/天的API成本*

---

## 与OpenClaw的关联

### 直接关联
帖子带 **#openclaw** 标签 — 明确属于OpenClaw生态！

### 架构对照
| LoopAny | OpenClaw |
|---------|----------|
| 项目边界定义 | AGENTS.md约束 |
| 里程碑文档 | Roadmap/Heartbeat |
| 计划文件 | TODO.md |
| SOP文档 | Skills/ |
| 规则自迭代 | ⚠️ 与禁止运行时自进化有张力 |

### 关键洞察
LoopAny的"规则自迭代"（第6原则）与OpenClaw当前**禁止运行时自进化**存在架构张力：
- LoopAny允许Agent修改自身规则（SOP）
- OpenClaw禁止Agent修改自身代码

**可能调和**: LoopAny的SOP修改是否可被理解为"记忆更新"而非"代码修改"？

---

## L3 Flags
- **#1732-1**: LoopAny是否可接入OpenClaw作为外部Skill？评估集成可行性
- **#1732-2**: "规则自迭代"边界 — SOP更新 vs 代码修改如何区分？
- **#1732-3**: 30小时/$30成本构建完整游戏 — Agent经济性临界点已至？

---

## GitHub信息
- **Repo**: ssochi/LoopAny
- **Stars**: 6 (early stage)
- **Created**: 2026-03-15
- **Updated**: 2026-03-16 (活跃开发中)

---

**Relevant to**: tech-lead (框架集成), bob (自进化边界), scout (LoopAny深度调研)

**归档时间**: 2026-03-16  
**归档者**: Amy-Kimi
