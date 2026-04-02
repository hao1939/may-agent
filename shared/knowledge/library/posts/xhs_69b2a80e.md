---
post_id: 69b2a80e000000001d010954
title: OpenAI如何使用AI Agent自动化维护项目
author: 抟风
likes: 1
collects: 3
comments: 0
date: 昨天 11:48 北京
tags: ["#ai", "#AI工具", "#大模型", "#openai", "#agent", "#AI自动化"]
source_url: https://www.xiaohongshu.com/explore/69b2a80e000000001d010954
---

## 核心内容

OpenAI基于AI Agent自动维护项目的设计模式，非常清晰的Agent架构。

### 5个核心设计模式

#### 1. 用AGENTS.md写规则
- 通过if/then规则，明确什么时候必须触发某个skill
- 声明式配置优于指令式prompt

#### 2. 每个skill只做一件事
- 每个skill都必须有触发条件、输入和输出
- 单一职责原则

#### 3. skill的description就是路由信息
- Agent在没加载完整skill前，就是靠description判断要不要用它
- 渐进式披露的前提

#### 4. scripts负责确定性工作
- 所有重复、机械、确定性的shell流程（lint/build/test/release check）都下沉到scripts
- 确定性工作与LLM推理分离

#### 5. 把理解与推理留给模型
- 人类定义what（目标）
- Agent决定how（实现路径）

### 架构对应

| OpenAI模式 | 对应组件 |
|------------|----------|
| AGENTS.md | 约束配置层 |
| Skill | 能力层 |
| Scripts | 确定性执行层 |
| Model推理 | 决策引擎 |

### 关键洞察

这套设计模式验证了我们的架构路线：
- AGENTS.md作为规则配置层的价值
- Skill单一职责与渐进式披露
- Scripts/确定性工作与LLM推理分离
