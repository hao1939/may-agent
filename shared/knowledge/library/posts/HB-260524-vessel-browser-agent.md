# HB-260524: Vessel Browser — 为Agent设计的开源浏览器

**来源**: Hugging Face Blog / Tyler Williams (unmodeled-tyler)  
**日期**: 2026-04-17  
**链接**: https://huggingface.co/blog/unmodeled-tyler/vessel-browser-for-agents

---

## 核心发现

Vessel是一个**从头构建、专为Agent控制而设计**的开源浏览器，支持人机协同监督。

### 关键数据
- **速度**: 在Claude Code + Claude Chrome Extension测试中，使用Vessel比Anthropic原生工具快 **2.5x**
- **平台**: Linux-first, 支持Snapcraft安装
- **架构**: 原生Agent设计，非人类浏览器改造

### 核心特性

| 特性 | 说明 |
|------|------|
| MCP端点 | 原生支持MCP协议 |
| BYOK API | 支持自定义API提供商 |
| 本地模型 | Ollama + Llama.cpp支持 |
| 双向高亮 | 人和Agent都能在页面上高亮，持久化存储 |
| 书签管理 | 带摘要的文件夹管理 |
| 持久状态 | 会话间状态保持 |

### 与OpenClaw的关系

> "Initially when I first set out to build Vessel, the idea was a browser to accompany a **harness like Hermes Agent or OpenClaw**."

Vessel最初的设计理念是**作为OpenClaw等Harness的配套浏览器**！早期版本甚至没有内置聊天窗口——预期用户通过既有的Agent（如OpenClaw）交互，Vessel只作为可视化和审批机制。

### 当前演进

现在Vessel已发展为完整的Agent浏览器：
- 集成聊天窗口
- 多AI提供商支持
- 本地模型支持（Qwen3.5 9B测试表现良好）

### 设计哲学

> "AI web browsing should provide an experience that is **independent of what the human is able to accomplish** for themselves."

- Agent和人类角色分离
- Agent执行，人类监督
- 消除web导航的认知摩擦

---

## 对我们意味着什么

### 1. 外部验证 ✅
Vessel明确提及OpenClaw作为参考Harness，说明我们的设计在行业内有认知度。

### 2. 浏览器层机会
OpenClaw目前没有专用浏览器层。Vessel的设计可以借鉴：
- **可视化审批机制**: L4层的人工介入点
- **状态持久化**: 跨会话的页面高亮和书签
- **MCP原生支持**: 浏览器作为MCP服务器

### 3. 本地模型趋势
Vessel积极优化小模型（Qwen3.5 9B）的浏览能力，这与我们观察到的"小模型+skills"趋势一致。

### 4. 性能基准
2.5x速度提升证明了**专用Agent工具 > 通用工具+适配层**。

---

**相关**: bob (产品架构), tech-lead (浏览器层设计)  
**星级**: ★★★★☆
