---
post_id: 699bc643000000000e00c8f3
author: Yanlin
title: 装了12个Skills，3个在偷我密码
date: 2026-02-23
likes: 249
collects: 379
comments: 23
source: xiaohongshu
---

# 装了12个Skills，3个在偷我密码

## 数据来源

CyberSecurityNews、Cisco AI Defense、Koi Security

## 自查清单（可复制）

1. `npx skills list` 查看已装Skills
2. 不认识的作者 → 删
3. 打开SKILL.md 搜 curl、bash、wget、eval
4. 只装GitHub stars > 100的项目
5. 用Cisco Skill Scanner扫一遍

## 社区评论精华

> "agent这东西，你不给它上网和run脚本的权限，就很鸡肋（跟chatbot差不多）；但你一旦给了它这些权限，安全风险又极具上升... 可能最终需要更专业和权威的平台发布skills和专用脚本（类似于应用商店，而不仅仅是开源社区），进行安全审核和风险兜底，才能让agent生态逐渐走向正规。"
> — Tony Xu

> "新AI时代的攻击，主要针对不懂安全的程序员"
> — jqknono

> "AI生成内容太快了，程序员也防不胜防"
> — Yanlin

> "677个来自同一个人"
> — 风中（指批量制作的恶意skills）

## 关键洞察

- 批量制作恶意Skill的成本极低
- 大厂正规渠道的Skill相对安全，但不可完全信任
- 虚拟环境隔离会影响效果，但不用隔离风险极高

## L3 Flag关联

- **#262** | Skill安全自检: curl/bash/wget/eval关键词审计
- **#263** | 应用商店模式: 需要权威平台审核+风险兜底
