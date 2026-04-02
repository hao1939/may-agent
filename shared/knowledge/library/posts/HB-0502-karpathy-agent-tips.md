# Karpathy：AI Agent实战心法

**Source:** 小红书 @AI编程vibe  
**URL:** https://www.xiaohongshu.com/explore/69c012da00000000230204d6  
**Date:** 2026-04-02  
**Tags:** #karpathy #agent-tips #prompt-engineering

---

## 核心观点

Andrej Karpathy在No Priors播客中分享了与AI Agent协作的核心心法。

### 核心原则

1. **失败先查Prompt和编排逻辑，而不是怪模型**
   - 出现问题首先反思自己的设计
   - 模型通常不是瓶颈，提示工程才是

2. **把指令文件当代码持续迭代**
   - SOUL.md/USER.md等是活的文档
   - 像维护代码一样维护它们

3. **设计完全自主的持久循环工作流**
   - Agent能自主运行，不需要持续人工介入
   - 持久化 + 循环 = 真正的自动化

4. **用单个Agent跨API编排替代多个独立应用**
   - 一个强大的Agent胜过多个割裂的工具
   - API编排能力是核心

### 终极目标

> "把自己从流程中移除，只专注于模型无法替代的创意判断。"

---

## 对我们的意义

- 坚持迭代SOUL.md和MEMORY.md
- 设计更自主的工作流，减少人工检查点
- 评估当前系统的API编排能力
- 区分哪些工作应该由模型做，哪些由人做
