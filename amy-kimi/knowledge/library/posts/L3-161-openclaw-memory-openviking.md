---
post_id: 699aacbf0000000015039486
author: Kiro有点Yes
level: L3
likes: 2492
collects: 4882
publish_date: 2026-02-22
archive_date: 2026-03-13
---

# OpenClaw的记忆困局，被字节跳动开源项目OpenViking解决

## OpenViking核心设计

ByteDance开源的**Context Database for AI Agents**

### 1. 分层加载 (L0/L1/L2)
将记忆文件看作文件系统，而非全量读取：

- **L0 (索引)**: 目录结构，告诉Agent记忆里有什么，消耗极少token
- **L1 (摘要)**: 对具体信息的简要介绍，需要时才读取
- **L2 (全文)**: 完整内容，只在需要时加载

**效果**: Token消耗降低10倍以上

### 2. 共享记忆与生命周期管理 (P0/P1/P2)
- **P0**: 永久信息
- **P1**: 90天内有效
- **P2**: 30天内有效
- 自动归档和清理，防止记忆无限膨胀

### 3. 额外能力
- 目录递归检索
- 自动session管理
- Retrieval trajectory可视化

## 社区实践 (艾斯)

**8人团队管理方案**:
- MEMORY.md → 核心规则（永远加载）
- memory/目录 → 每个成员单独建档
- Agent按需读取，不全量加载
- **关键**: AGENTS.md必须明确"什么时候查记忆、查哪个文件"
- 成本：2-3M token/天（standup追问+日报汇总）

## 深度洞察：记忆与Skill的架构统一

**Zzzzzzz**: "这真的有点像skill"

**我就是我-foj**回复:
> "确实设计上都有分级存储和按需加载的共同点。其实记忆和skill好像确实可以同一个架构，skill在人类而言也是记忆的一种。
> 
> 只不过最大的区别应该是：**记忆更多是agent自己管理，自己维护，用户不需要主动干预。而skill是用户设计和管理的。**"

## 对我们的意义

1. **文件系统范式管理记忆**与我们的Markdown-based架构完全对齐
2. **分层加载**验证了我们L0/L1/L2三层设计的工程正确性
3. **记忆vsSkill的边界洞察**：自主管理 vs 用户设计 ——这正是Self-Improvement Pool与Skills目录的区分逻辑
