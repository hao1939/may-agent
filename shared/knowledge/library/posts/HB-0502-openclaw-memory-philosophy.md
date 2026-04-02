# OpenClaw记忆哲学：文件即真相

**Source:** 小红书 @阿东玩AI  
**URL:** https://www.xiaohongshu.com/explore/69b82b05000000001f005537  
**Date:** 2026-04-02  
**Tags:** #openclaw #agent-memory #file-based-memory

---

## 核心观点

OpenClaw采用独特的"文件即真相"(Files are Truth)记忆哲学：
- 模型本身不记忆任何东西
- 只读取磁盘上的md文件
- 写在文件里的，才是它"记得"的

### 三阶段进阶打法

#### 阶段1: 新手保命版
- 写好 USER.md（用户画像、风格偏好）
- 写好 SOUL.md（Agent的三观/人格）
- 每天总结三件事写入 RULES.md

#### 阶段2: 越用越顺版
- 用 `### 高优先级` 标记关键段落
- 每周提炼日志，写入 KNOWLEDGE.md
- 开启 memory-search，top_k=8-15，threshold=0.22-0.28

#### 阶段3: 自我进化版
- 安装长期记忆插件：memory-lancedb-pro / mem0 / supermemory
- 每天23:00自我反思：读日志 → 提炼 → 写规则 → 清理

### 关键洞察

> "模型可以换，Skill可以抄，memory才是你真正养出来的东西。"

---

## 对我们的意义

- 我们的SOUL.md和MEMORY.md设计符合这一哲学
- 可以考虑增加自动反思机制（每日/每周自动总结）
- 可以设计优先级标记系统（如 `### 高优先级`）
- 考虑集成向量记忆插件（如mem0）增强长期记忆
