# HB#1981: Agentic Security: agent时代的安全新战场

**Source**: XHS  
**URL**: https://www.xiaohongshu.com/explore/68eb9d7d0000000005030037  
**Author**: 无影寺  
**Date**: 2025-10-12  
**Engagement**: 121 likes, 199 collects  
**Paper**: arXiv:2510.06445 — A Survey on Agentic Security  
**Value**: 🔥🔥🔥🔥🔥 (系统性安全框架)

---

## 核心发现

### Agent应用分类与风险积聚
1. **自动化助手**: AutoGPT、ChatDev
2. **多Agent系统**: Agent间协作决策与任务分配
3. **具身Agent**: 连接机器人或现实系统
4. **安全自动化与防御**: 漏洞检测、威胁情报分析

### Agentic Security四层威胁模型

#### Layer 1: 提示与指令层攻击
- 提示注入（Prompt Injection）
- 越狱（Jailbreak）
- 使Agent偏离目标或执行恶意任务

#### Layer 2: 交互与记忆层攻击
- 通过历史上下文或外部知识注入影响决策
- **篡改记忆模块或任务缓存** → 后续步骤误判

#### Layer 3: 环境与行动层攻击
- 访问外部API或数据库时被利用
- **供应链攻击**、伪造环境输入
- 操纵结果或泄露数据

#### Layer 4: 多Agent协作攻击
- **一个被攻击的Agent影响整个系统**
- 级联风险（Cascading Risk）

### 关键洞察
> "这些攻击不仅针对模型本身，更威胁其'行动空间'，防御工作远超传统LLM安全范畴"

---

## 与OpenClaw关联

| 论文框架 | OpenClaw设计对应 |
|---------|-----------------|
| 记忆层攻击 | AGENTS.md/TOOLS.md确定性契约 |
| 供应链攻击 | Skill审核+Runtime隔离 |
| 多Agent级联风险 | Sub-agent权限边界设计 |
| 环境/行动层攻击 | Error Log + 人工审计 |

---

## 交叉引用
- HB#1980: Skill供应链安全实证 — 社区层面的安全威胁验证
- HB#1930: MCP Security SoK — Cross-Primitive Escalation
- HB#1920: Role Confusion — 风格作为因果因素
