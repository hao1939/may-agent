# Just-in-Time Context: 上下文工程的范式转移

**来源**: 小红书 (XHS) | 作者: whisper | 529赞 / 824收藏 / 22评论  
**链接**: https://www.xiaohongshu.com/explore/694035ef000000001b030970  
**日期**: 2025-12-15

---

## 核心洞察

**从LLM被动接收上下文，到Agent主动获取上下文（Just-in-Time Context / Agentic Context）**

这篇35分钟阅读深度的技术文章，结合Anthropic博客和Agent产品体验，系统阐述了上下文工程的关键范式转移。

---

## 内容架构

### 🥕 Recall: Context Engineering的What & Why
重温并拓展上下文工程的基础概念

### 🥕 JIT Context: 什么是Just-in-Time Context
- **定义**: Agent不再被动等待上下文被填充，而是主动决定何时、获取什么上下文
- **别名**: Agentic Context（Agent化的上下文管理）
- **核心转变**: 从"给AI所有可能相关的信息"到"AI按需索取必要信息"

### 🥕 Effective JIT Context Engineering
JIT的代价，以及如何通过**Compress / Write / Isolate**实现高效的上下文管理

---

## 关键评论与洞察

### Context Engineering ≈ 内存管理
**StevenSYT**:
> "非常同意context engineering很像内存管理。在agent这块我们的内存管理还很初级而且值得深挖。我们完全不用频繁的重启电脑，但是大部分时间不用担心内存爆了。想象一下，以后的agent有没有可能**完全动态的管理context，而永远不用重开一个session**呢？所有执行过的任务都是可以被再次访问的长记忆。"

**whisper回应**:
> "是的，我觉得是有这个潜力的：大部分context留给处理及时问题（load context & reasoning），小部分context用来存储必要索引。理论上如果model capability & context engineering同时超过某个阈值，应该会有一次比较革命性的性能提升？"

### AI从"工具"向"伙伴"进化
**林阿福Alfred**:
> "从被动接收到主动获取，这不仅是上下文工程的范式转移，更是AI从'工具'向'伙伴'进化的关键一步。Just-in-Time Context让Agent拥有了'按需思考'的能力，这种动态性正是人类智能的核心特征。"

### 产品实践的核心痛点
**jjdd dm（ex）**:
> "这篇文章很干，谢谢作者。但是，我至今没有找到一篇文章可以跟我们讨论一下**'处理速度，稳定性'**，在对话场景中，这很重要，但是，很遗憾，没人讨论。（这是我在产品实践中遇到的最核心的问题）"

**whisper回应**:
> "处理速度属于推理优化非常复杂...常见的是prompt cache / continuous batching，也有模型层面的比如flash attention或者模型量化...基本上只有模型提供商才能做推理优化"

> "至于稳定性，我猜测你说的可能是模型推理时的参数temperature，温度越低输出的结果越稳定。"

---

## 对OpenClaw的意义

| 维度 | 洞察 | OpenClaw启示 |
|------|------|--------------|
| **架构设计** | JIT Context = Agent主动获取而非被动接收 | 设计Agent可主动查询的Context API |
| **Memory管理** | Context Engineering ≈ 内存管理 | 借鉴OS内存管理: 分页、缓存、换入换出 |
| **Session生命周期** | "永远不用重开session"的愿景 | 探索无限长Session的可行性 |
| **性能优化** | Prompt Cache + Continuous Batching | 集成推理层优化 |
| **稳定性** | Temperature=0对稳定性至关重要 | Skill执行强制temperature=0 |

---

## Critical Questions for OpenClaw

1. **Context API**: 是否支持Agent主动查询上下文，而非被动填充？
2. **内存管理**: 是否借鉴OS内存管理设计（page、cache、swap）？
3. **无限Session**: 技术上是否可能实现"永不重启"的Session？
4. **推理优化**: Prompt Cache和Continuous Batching是否在路线图中？
5. **稳定性**: Skill执行是否强制temperature=0以确保确定性？

---

## 相关资源

- 作者博客主要在知乎发布
- 文章PDF版本可下载（13页，270浏览，98人下载）
- 主线参考Anthropic博客

---

**标签**: #ContextEngineering #JustInTime #AgenticContext #Anthropic #内存管理
