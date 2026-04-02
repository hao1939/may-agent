# HB#1760 — OpenClaw 14天血泪经验: 5条实战法则

**Source**: XHS@愚园路十二妹 (832赞/1917收藏/53评论)  
**Date**: 2026-02-12 / 2026-03-16 (发现日期)  
**Type**: 社区实战经验总结

---

## 核心发现: 5条实战经验

作者从1个Agent折腾到3个，踩了20+坑后总结的5条最值钱经验：

### 1️⃣ MEMORY.md只放索引不放内容
- ❌ 不要把所有内容塞进MEMORY.md
- ✅ 使用**索引化结构**: MEMORY.md作为目录，详细内容拆分到 `memory/` 目录下的专题文件
- 💡 避免"龙虾嫌太长不看"的问题

### 2️⃣ 多Agent隔离workspace
- 每个Agent独立workspace避免冲突
- ⚠️ 注意: skill路径配置问题（相对路径是相对于workspace还是skill目录）
- 可在agent配置中把skill目录加到allowlist

### 3️⃣ 记忆自动化cron
- 设置自动化任务管理记忆压缩/归档
- 避免memory塞爆
- 💬 社区验证: "memory塞爆是我了…"

### 4️⃣ Markdown GTD管理任务
- 使用Markdown格式进行任务管理
- 与OpenClaw的文件系统原生兼容

### 5️⃣ SOUL.md写出灵魂
- SOUL.md是Agent的"灵魂"定义
- 精心编写可显著提升Agent表现

---

## 社区讨论精华

### 痛点共鸣
| 用户 | 问题 | 解决方案 |
|------|------|---------|
| 渡文。 | 多Agent直接导致OpenClaw重装 | workspace隔离+进程调优 |
| HaKeN.39 | memory塞爆 | 索引化+自动化cron |
| AI小龙虾新玩家 | 单渠道消息网关故障 | **双渠道冗余** (Telegram+飞书/ WhatsApp+Gmail) |
| 小羊不受影响 | workspace文件被清空 | compaction配置+压缩前自动写current-task.md |

### 双渠道冗余 (第6条经验)
> "一定要设双渠道发消息。我之前只用WhatsApp，结果凌晨2点网关挂了所有提醒全失灵。加了Gmail备用渠道后再也没漏过。"

> "建议开heartbeat定时检测，凌晨挂了能第一时间知道。"

### 国产模型配置坑
> "Moonshot的.ai和.cn端点不一样…"

---

## 对OpenClaw的意义

### ✅ 验证现有设计
1. **MEMORY.md索引化** — 与OpenClaw推荐的"索引+专题文件"模式一致
2. **Workspace隔离** — 多Agent架构的必要条件
3. **Cron自动化** — 与OpenClaw内置cron支持吻合

### ⚠️ 发现的新问题
1. **Skill路径配置复杂性** — 相对路径基准点不明确
2. **Workspace压缩丢失上下文** — compaction时可能丢失identity.md/user.md
3. **人设恢复问题** — Agent可能不自动读取.md文件恢复人设

### 🔧 待改进点
- [ ] Skill路径配置文档化（明确相对路径基准）
- [ ] Compaction策略优化（保护核心identity文件）
- [ ] 启动时自动重载人设机制

---

## 作者核心洞察

> "文件夹结构不是重点，记忆管理策略才是核心。"

> "记忆管理确实是现阶段AI agent的核心问题，解决了它才能真正'长期陪伴'而不是每次重新认识你。"

---

**Relevant to**: tech-lead (实现改进), bob (文档设计)
