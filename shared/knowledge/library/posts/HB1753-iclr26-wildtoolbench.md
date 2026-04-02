# HB#1753: WildToolBench — Agent是强大的，但用户是狂野的

**Source**: XHS@thinkwee (腾讯×KCL)  
**Link**: https://www.xiaohongshu.com/explore/69a5745a000000002203997f  
**Date**: 2026-03-02  
**Engagement**: 148赞 / 178收藏 / 6评论  
**ICLR**: 2026 Oral  

---

## 论文核心

**WildToolBench: Benchmarking LLM Tool-Use in the Wild**

作者直面Shunyu Yao的批评（"国内追逐榜单严重，忽略用户实际体验"），提出真实世界工具调用benchmark的核心理念：**用户是不完美的**。

### 三类"Wild"用户行为模式

| 模式 | 描述 | OpenClaw对应机制 |
|------|------|-----------------|
| **复杂多要求** | 单问题含多重要求，单步/串联工具难以完美交付 | Error Log分解 + Sub-agent并行 |
| **隐含上下文** | 多轮对话中混杂指代、隐藏意图，需LLM推断 | Context窗口 + AGENTS.md状态追踪 |
| **模式频繁切换** | 工具调用/直接回答/澄清请求间频繁切换 | Skills vs AGENTS.md分工 + Intent分类 |

### 关键数据

- **256个场景**构建的Benchmark
- **57个模型**测试（开源/闭源/专有思考Agentic）
- **最强模型session准确率 < 15%**（测试时点）

### 行业演进

论文观察到过去一年行业针对这三类问题的改进：
- **Anthropic**: Programmatic tool calling — 将复杂工具编排作为coding看待
- **各模型**: 更精准判断"何时主动回答/何时调工具/何时澄清"

---

## 对OpenClaw的验证

这篇论文**直接验证**了OpenClaw设计的三个核心假设：

1. ✅ **Error Log机制** — 应对复杂多要求问题的分解策略
2. ✅ **Context Engineering > Tool Engineering** — 隐含上下文管理比工具数量更重要
3. ✅ **AGENTS.md被动上下文** — 处理模式切换时的状态保持

---

## L3 Flag

**#1753.1**: WildToolBench揭示的15%准确率 Gap — OpenClaw的Error Log + Context机制是否已系统性解决？需评估。

---

## Cross-Reference

- HB#1741 (DeerFlow): 字节Super Agent的复杂任务分解
- HB#1737 (SuperPowers): 7阶段Agent架构与工具编排
- HB#502 (Context vs Tools): 上下文优先vs工具优先的路线之争
