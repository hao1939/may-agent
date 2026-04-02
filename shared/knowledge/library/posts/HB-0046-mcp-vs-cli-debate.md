# MCP vs CLI: 工具交互范式的争论

**Source:** XHS @有个小店, @好记星.ai  
**Date:** 2025-03-13 to 2025-03-18  
**Engagement:** 1462 likes, 1692 collects (有个小店); 478 likes, 710 collects (好记星.ai)  
**URLs:** 
- https://www.xiaohongshu.com/explore/69ba3dae000000001f001866
- https://www.xiaohongshu.com/explore/69b36dd20000000022030f0d

---

## Overview

中文AI社区正在激烈讨论MCP (Model Context Protocol) 的局限性，以及CLI (Command Line Interface) 作为替代方案的可行性。这场讨论反映了Agent工具交互架构的演进方向。

---

## MCP的核心问题

### 1. 上下文成本高 (Linear Context Cost)
- 每增加一个工具都会消耗大量Token
- 工具描述随请求反复传递
- 导致成本飙升和推理能力下降

### 2. 配置繁琐 (Configuration Complexity)
- 初始化步骤多
- 认证疲劳 (authentication fatigue)
- 权限控制粗糙

### 3. 使用现状
- 被Perplexity等公司放弃
- 逐渐从"通用标准"下沉为"企业集成中间件"

---

## CLI范式的优势

### 核心理念
将操作系统作为天然的"工具服务器"，AI直接执行Shell命令。

### 优势
| 特性 | 说明 |
|------|------|
| 透明可调试 | 命令可见，错误可追踪 |
| 可组合性强 | Unix哲学，管道组合 |
| 借力现有生态 | 复用数十年的CLI工具 |
| 反馈准确 | 直接操作，结果立即可见 |

### 代表实践
- **OpenClaw** 的 Skills 系统
- **微软** 在某些场景用CLI替代MCP
- **Skills** 作为CLI范式的上层封装

---

## 社区观点对比

### 支持CLI/Skills的观点
> "skill比mcp好用太多了，主要是现在模型性能上去了，当初整的这一套为了消除幻觉协议反而成为了掣肘。"
> — @vyfe

> "说白了，skills这个东西是给有独立运行环境的Agent用的，才能把cli优势发挥到极致"
> — @十六

### 支持MCP的观点
> "首先不是所有服务都有cli，其次mcp本质上是定义tools，模型对tools依从度比你卸载prompt里的cli教学更好"
> — @小红薯62B95644

> "MCP和CLI其实是互补关系，MCP提供标准化接口，CLI更轻量直接。"
> — @未来水世界

### 中立/融合观点
> "CLI 和 MCP 并非简单的替代关系，而是互补共存的。"
> — @有个小店 (作者)

> "MCP 和 CLI 不是替代关系，是场景选择。场景明确→CLI直接调用；场景多变→MCP抽象层。"
> — @经常不睡觉

---

## 适用场景总结

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 本地开发/个人Agent | CLI/Skills | 轻量、透明、高效 |
| 企业集成 | MCP | 标准化、安全可控 |
| 电商平台等 | MCP/Function Call | 需要稳定的API封装 |
| 快速原型 | CLI | 无需配置，即开即用 |

---

## Implications for Our System

**Key Question:** Should our skill system adopt CLI-like execution or MCP-style protocol?

**Insights:**
1. **Skills as CLI** — Our current skill system aligns with the "Skills = CLI paradigm" approach that's gaining traction
2. **Context Efficiency** — We should monitor how much context our skill definitions consume
3. **Hybrid Approach** — Consider CLI for built-in skills, MCP for third-party integrations
4. **The "龙虾" Effect** — Reference toOpenClaw (龙虾) — skills-based approach is winning mindshare

**Action Items:**
- [ ] Audit current skill system's context usage
- [ ] Benchmark CLI-style vs MCP-style for common tasks
- [ ] Evaluate if we need an MCP adapter for external tools

---

## Tags
#mcp #cli #tools #agent-architecture #skills #openclaw
