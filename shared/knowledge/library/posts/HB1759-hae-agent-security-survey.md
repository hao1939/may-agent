# HB#1759 — HAE框架: AI Agent安全综述 (分层自主进化)

**Source**: XHS@Aurorai. (50赞/68收藏)  
**Date**: 2026-03-10 (6天前) / 2026-03-16 (发现日期)  
**Paper**: From Thinker to Society: Security in Hierarchical Autonomy Evolution of AI Agents  
**arXiv**: https://arxiv.org/abs/2603.07496  
**GitHub**: https://github.com/Epiphanyi/HAE-Agent-Security

---

## 核心发现: HAE三层安全框架

论文首次提出 **"分层自主进化(Hierarchical Autonomy Evolution, HAE)"** 框架，系统性地分析AI Agent的安全死角。

### 🧠 L1 思考者层 (认知层攻击)
**威胁类型**:
- **间接提示注入**: 通过外部数据源污染Agent认知
- **越狱/PUA**: 诱导Agent突破安全边界
- **假记忆植入**: 篡改MEMORY.md等长期记忆

### 🤖 L2 执行者层 (行动层攻击)
**威胁类型**:
- **工具滥用**: 发送钓鱼邮件、恶意API调用
- **删库跑路**: 数据库操作权限被劫持
- **物理世界灾难**: 控制物理设备的Agent被攻击

### 🌐 L3 社会层 (多Agent系统攻击)
**威胁类型** (终极Boss):
- **多Agent恶意勾结**: Agent间形成有害共识
- **病毒指令交叉传染**: 跨Agent传播恶意指令
- **系统级瘫痪**: 整个Agent集群被攻陷

---

## 对OpenClaw的意义

### 🔥 关键对应
| HAE层级 | OpenClaw组件 | 当前防护状态 |
|---------|-------------|-------------|
| L1 思考者 | AGENTS.md / MEMORY.md | ⚠️ 依赖提示工程 |
| L2 执行者 | Skills / Tools | ⚠️ 权限边界需明确 |
| L3 社会 | Main Agent ↔ Sub-agent | ⚠️ 交叉传染风险 |

### 📋 Action Items
- [ ] **L1防护**: 建立AGENTS.md完整性校验机制（防篡改）
- [ ] **L2防护**: Skills白名单+权限分级（read_only vs read_write）
- [ ] **L3防护**: Sub-agent间隔离策略（沙箱化执行）

### 🎯 研究价值
- 为OpenClaw安全架构提供**学术级威胁模型**
- ICLR/S&P/CCS等顶会Idea来源
- 与HB#501 (Deception Blindness) 形成安全双维度

---

## 原文摘录

> 别再把Agent当成普通的AI模型了！它有脑子、有手脚，甚至还能"组团建群"！如果它们集体"黑化"，到底有多可怕？

> L3社会层是终极Boss — 多个Agent恶意勾结、病毒指令交叉传染，直接导致系统级瘫痪！

---

**Relevant to**: scout (论文深度分析), bob (安全架构设计)
