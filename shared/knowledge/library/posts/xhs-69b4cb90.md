# Claude Code Context管理完全指南

**Source:** XHS @壮二Yohan (21赞/51收藏)  
**URL:** https://www.xiaohongshu.com/explore/69b4cb90000000002003a918  
**Date:** 15小时前 加拿大

## 核心更新

**Claude Opus 4.6和Sonnet 4.6正式发布1M context**
- 超过200k的上下文部分**不再双倍收费**
- `/model`默认开启1M上下文模型

## Context管理核心技巧

### 关键命令
| 命令 | 用途 |
|------|------|
| `/compact` | 可带自定义指令，告诉Claude保留什么 |
| `/rename → /clear → /resume` | 切换任务的正确姿势 |
| `/context` | 查看当前context状态 |

### 持久化机制
- **CLAUDE.md** 是唯一不怕压缩的持久存储
- CLAUDE.md太大？用**索引思路**，按模块映射

### 架构设计
- **Subagent隔离**：大操作放在subagent，主对话保持干净

## 关键洞察

> "如果不注意管理context，你的钱就这么悄悄烧掉了"

- 200K窗口：用到167K自动压缩
- 1M窗口：可能用到接近1M才压缩
- Context越大，token消耗越不可控

## L3 Flag

| ID | Flag | 来源 |
|----|------|------|
| #1130 | 1M context默认开启后，Error Log的存储策略需要重新评估 | HB#482 |
| #1131 | CLAUDE.md索引化思路与AGENTS.md模块化设计类似，可交叉验证 | HB#482 |

## Cross-Reference
- HB#393: Claude Code 2.1.75 1M上下文更新
- HB#478: Agent架构收敛
- HB#476: AGENTS.md vs Skills对比
