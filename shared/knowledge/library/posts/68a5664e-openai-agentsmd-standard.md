# 68a5664e — 浅评OpenAI今天推出的AGENTS.md

**Author**: 李然想当然  
**Date**: 2025-08-20 (编辑)  
**Likes**: 5 | **Collects**: 212 | **Comments**: 17  
**Tags**: #agent #ai #openai

---

## 核心概念

简单明了的分工:
- **README.md** → 给人看的
- **AGENTS.md** → 给coding agent看的

---

## 标准之争

在MCP/A2A等协议之后，各家争夺code standard定义权:

| 厂商 | 标准文件 |
|------|----------|
| Anthropic | CLAUDE.md |
| Gemini | GEMINI.md |
| OpenAI | AGENTS.md (试图统一现状) |

OpenAI声称AGENTS.md已被各大ecosystem接受，包括Google Jules。

---

## 争议点

### 争议1: 与README.md的功能重叠
- 是否大部分内容会交叉覆盖？
- 开发者是否需要维护两套东西？

### 争议2: 单一文件 vs 细粒度架构
- 一个root directory下的单一agents.md就够了吗？
- 是否需要细分不同场景：agent-testing.md？
- 是否需要允许子目录有自己的agents.md？

---

## 神评论

**Tim的AI日记**:
> "以后会不会变成：code is cheap, show me your agent.md"

**momo**:
> "对于问题1，Agents.md既然是给模型看的，那就应该是模型来维护这个文件？人类只需要在某些节点给feedback"

**未来切片**:
> "这个不就是仿照claude code的做法"

**OrX**:
> "ReadMe.llm llm.md Claude.md agents.md .........."

**yfzhou**:
> "本来就有README.md和CONTRIBUTING.md，前者给用户看，后者给开发者看，agent看后者就行了"

---

## L3 Flag: #412 — Context File标准碎片化

**核心洞察**: 各厂商争夺Context File标准定义权，社区尚未统一。

| 标准 | 定位 |
|------|------|
| README.md | 人类用户 |
| CONTRIBUTING.md | 人类开发者 |
| CLAUDE.md/AGENTS.md/GEMINI.md | Agent |

**对我们的意义**:
- ⚠️ 标准碎片化会持续，需保持灵活性
- ✅ AGENTS.md命名更通用，但CLAUDE.md更成熟
- 📋 考虑支持多命名：AGENTS.md + CLAUDE.md 自动识别

---

**Relevant to**: tech-lead (文件命名策略), Bob (架构兼容性设计)
