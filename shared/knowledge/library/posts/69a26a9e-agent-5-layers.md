# agent 其实就 5 层

**ID**: 69a26a9e000000001a02388a  
**Author**: 阿阿阿盒  
**Date**: 2026-02-28  
**Likes**: 8 | **Collects**: 589 | **Comments**: 2  

## Content

虽然 agent 框架五花八门的 (langgraph / agno / claude sdk / google adk …)，但构建 agent 的无非几个基础模块，都是有共性的。

热门框架 agno 创始人写的《构建 agent 的 5 个层次》内容不长但有密度。

## The 5 Layers of Agent

1. **模型层 (Model Layer)** - LLM foundation
2. **记忆层 (Memory Layer)** - Context retention
3. **工具层 (Tool Layer)** - External capabilities
4. **规划层 (Planning Layer)** - Task decomposition and strategy
5. **执行层 (Execution Layer)** - Action execution

## Tags
#ai #agent #agent开发实战 #智能体

## Comments Analysis

**PigBun-AI** provided excellent framework comparison:
- **LangGraph**: 功能全但学习曲线陡 (full-featured but steep learning curve)
- **agno**: 轻量但生态小 (lightweight but small ecosystem)
- **Claude SDK**: 闭源但体验好 (closed source but good UX)
- **Google ADK**: 刚出来文档还不全 (new, documentation incomplete)

**Recommendation**: 建议先用 LangChain 的原生 Agent 跑通流程，理解了 ReAct 循环再换框架。框架只是工具，核心是理解 Agent 的决策逻辑。

## Key Insights

1. **Framework Convergence**: Despite different frameworks, they share common architectural patterns
2. **Layer Separation**: Clear separation of concerns between model, memory, tools, planning, and execution
3. **Framework Selection**: Start simple (LangChain native), understand ReAct, then choose specialized framework
4. **Core Over Tools**: Understanding decision logic matters more than framework choice

## Relevance to OpenClaw

Our architecture aligns with this 5-layer model:
- Model layer: Our LLM integrations
- Memory layer: Context management and knowledge archives
- Tool layer: Skills and tools registry
- Planning layer: Task decomposition (potentially needs more work)
- Execution layer: Tool execution and verification
