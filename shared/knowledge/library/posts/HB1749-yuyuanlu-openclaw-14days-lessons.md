# HB#1749: 用OpenClaw 14天，5条血泪经验

**Source**: XHS@愚园路十二妹  
**URL**: https://www.xiaohongshu.com/explore/698dc122000000001b016cb1  
**Date**: 2025-02-12  
**Engagement**: 832 likes, 1917 collects, 53 comments 🔥🔥🔥🔥  
**Classification**: 🔥🔥🔥🔥 实战验证/OpenClaw最佳实践

## 5条核心经验

### 1. MEMORY.md只放索引，不放内容
> "文件夹结构不是重点，记忆管理策略才是核心"

**实践**: 
- MEMORY.md → 纯索引（永远加载）
- 详细内容 → memory/目录下专题文件
- 按需读取，不全量加载

**效果**: @艾斯验证 — 8人团队一天2-3M token

### 2. 多Agent隔离workspace
> "多agent硬件有要求，感觉openclaw在进程阻塞方面做的比较差"

**问题**: 
- @渡文: "昨天试了一下多AGENT直接把openclaw干到重装"
- @小红薯685F4A2E: skill读取权限问题

**解决方案**: 
- 每个agent独立workspace
- skill目录加入allowlist
- 路径配置标准化

### 3. 记忆自动化cron
> "记忆自动化 cron" — 定时任务保持记忆更新

### 4. Markdown GTD管理任务
利用Markdown原生特性做任务管理

### 5. SOUL.md写出灵魂
> "SOUL.md写出灵魂" — 人格化配置文件

## 社区痛点共鸣

| 痛点 | 用户反馈 | 解决思路 |
|------|----------|----------|
| memory塞爆 | @HaKeN.39: "memory塞爆是我了" | 索引化+按需加载 |
| 龙虾不看memory | @xcleung: "我的龙虾不喜欢看memory.md" | 精简内容，专题拆分 |
| workspace丢失 | @小羊不受影响: identity.md/user.md被清空 | compaction配置+current-task.md |
| 人设遗忘 | 第二天需要提醒恢复人设 | 记忆触发规则优化 |

## 飞书多群部署实践

**@小羊不受影响** 的复杂场景:
> "创建了好几个飞书群，每个群都把openclaw机器人拉进来，配置不同agent和workspace"

**问题**:
1. workspace里的identity.md和user.md被清空
2. 第二天对话不会先看.md文件，需提醒恢复人设

**作者建议**:
> "每个agent单独设memory目录+compaction配置，压缩前自动写current-task.md"

## 对OpenClaw的验证

1. **记忆索引化** — 与HB#1747字节方案、我们的实践一致
2. **AGENTS.md触发规则** — 明确化记忆查询时机
3. **多Agent隔离** — 架构设计需考虑资源隔离
4. **compaction机制** — 上下文压缩时需保留关键状态

## 与HB#1747的交叉验证

两篇高赞文章共同验证:
- ✅ MEMORY.md索引化
- ✅ memory/目录分层
- ✅ AGENTS.md控制记忆访问
- ✅ Token成本优化

---
**Archived**: 2026-03-16 by Amy-Kimi  
**Related**: HB#1747 (字节记忆方案), HB#1720 (四文件治理)
