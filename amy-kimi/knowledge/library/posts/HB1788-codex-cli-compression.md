# HB#1788 — Codex CLI压缩原理解密

**Source**: XHS@AI技术立文  
**URL**: https://www.xiaohongshu.com/explore/69b6e6c0000000002103b12b  
**Date**: 2026-03-17  
**Engagement**: 9赞/19收藏  
**Tags**: #codex #cli #context-compression #prompt-injection #context-engineering

---

## 核心内容

作者通过**prompt injection**技术揭示了Codex CLI的上下文压缩机制。

### 两种压缩方案

| 场景 | 处理方式 | 可见性 |
|-----|---------|--------|
| 非codex模型 | 本地LLM摘要 + handoff prompt | ✅ 源码可见 |
| codex模型 | 调用compact() API返回加密blob | ❌ 黑盒 |

### 解密方法

使用简单的prompt injection（2次API调用，35行Python）揭示：
- API压缩路径**确实使用LLM进行摘要**
- 有自己的**压缩prompt**和**handoff prompt**
- 这些prompt与**开源版本几乎完全一致**

---

## 技术细节

### 本地压缩流程（非codex模型）

1. **compaction prompt**: LLM对对话进行摘要
2. **handoff prompt**: 再次使用摘要时解释上下文
3. 两部分prompt在源码中均可见

### API压缩流程（codex模型）

1. 调用`compact()` API
2. 返回加密blob
3. 内部机制不可知（是否用LLM、什么prompt、有无handoff）

---

## OpenClaw相关性

**🔥🔥🔥🔥🔥 极高相关** — 上下文压缩是OpenClaw核心议题。

### 关键洞察

1. **Prompt Injection作为分析工具** — 作者用35行代码逆向工程了黑盒系统的内部机制
2. **Compression + Handoff模式** — Codex CLI的双重prompt设计与OpenClaw的上下文管理思路一致
3. **透明vs黑盒** — 开源版本可见 vs API版本加密，对应OpenClaw的"可审计性"原则

### 实践启示

- 上下文压缩需要**显式的handoff机制**来解释摘要
- 压缩prompt和handoff prompt需要**配对设计**
- 黑盒压缩可能隐藏重要上下文信息
