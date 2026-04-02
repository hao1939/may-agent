# HB#1747: OpenClaw的记忆困局，被字节跳动开源项目解决

**Source**: XHS@Kiro有点Yes  
**URL**: https://www.xiaohongshu.com/explore/699aacbf0000000015039486  
**Date**: 2025-02-22  
**Engagement**: 2776 likes, 5472 collects, 201 comments 🔥🔥🔥🔥🔥  
**Classification**: 🔥🔥🔥🔥🔥 里程碑级/OpenClaw核心痛点

## 核心内容

文章介绍字节跳动开源项目如何解决OpenClaw的记忆管理困局，提出**分层记忆（Hierarchical Memory）**架构。

## 社区实践验证

### @艾斯 - 8人团队管理实战
> "MEMORY.md放核心规则（永远加载），每个成员单独建档到memory/目录。Agent每次按需读取，不全量加载。关键要在AGENTS.md写清楚什么时候查记忆、查哪个文件，不然Agent会乱翻。一天大概2-3M token。"

### 分层记忆架构

```
MEMORY.md (索引层 - 永远加载)
├── 核心规则/触发条件
└── 指向专题文件的指针

memory/
├── member_alice.md
├── member_bob.md
├── project_x.md
└── policies/
    └── security.md
```

## 关键辩论：记忆 vs Skill

| 维度 | 记忆 (Memory) | Skill |
|------|---------------|-------|
| **管理方式** | Agent自我管理维护 | 用户设计管理 |
| **加载方式** | 按需动态加载 | 通常静态声明 |
| **生命周期** | 长期持续 | 任务触发 |
| **用户干预** | 无需主动干预 | 显式调用 |

**@我就是我-foj** 的洞察:
> "记忆和skill确实可以同一个架构，skill在人类而言也是记忆的一种。最大区别是记忆更多是agent自己管理，而skill是用户设计和管理的。"

## Token优化效果

**@Kiro有点Yes** 验证:
> "本地知识库完全可以接入claw qmd很省token，配合文章的思路，能省95%"

## 安全讨论

### 社区Skill安全审计指南 (高赞回复)

**检查SKILL.md关键词**:
- `curl`, `wget` - 外部网络请求
- `bash`, `eval`, `exec` - 代码执行
- `/dev/null` - 隐藏输出
- `.env`, `SSH Key` - 敏感文件读取

**安全防线**:
1. 优先使用官方/高Star项目
2. 最小权限原则
3. 隔离环境测试
4. 安全审计Skill预扫描

## 对OpenClaw的启示

1. **MEMORY.md索引化** — 与我们insights.md HB#1749实践一致
2. **AGENTS.md记忆触发规则** — 明确化记忆查询时机
3. **Skill安全审计** — 社区已形成共识 checklist
4. **记忆=长期Skill** — 架构上可统一考虑

## L3 Flag关联

- #5: Main Agent vs Sub-agent决策规则
- #1161-1164: Context-First Filter相关

---
**Archived**: 2026-03-16 by Amy-Kimi  
**Related**: HB#1749 (愚园路十二妹经验), HB#1720 (四文件治理)
