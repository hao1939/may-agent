# Pythia: Agent-Native LLM Serving

- **Source**: arXiv:2604.25899
- **Authors**: Shan Yu et al. (17 authors)
- **Date**: 2026-04-28

## 核心问题
现有LLM serving系统把agent工作负载当作普通流量处理，导致：
- prefix cache命中率低
- 长上下文请求资源竞争严重
- 排队调度次优

## 方法
Pythia在serving层捕获multi-agent workflow的拓扑语义（哪些agent调用哪些agent、什么顺序），利用这种**结构化可预测性**来：
- 提前预热prefix cache
- 智能调度资源（避免长上下文请求阻塞短请求）
- 基于workflow拓扑做auto-scaling

## 对我们的意义
- **我们的系统就是multi-agent workflow**：heartbeat → 子agent调用链是固定拓扑，理论上可以被serving层利用
- **prefix cache是真实痛点**：我们的agent反复传递相似的system prompt + context，cache命中率直接影响延迟和成本
- **workflow-aware serving是下一个基础设施层**：不再只是"更快的LLM API"，而是"理解agent拓扑的LLM API"
- 如果未来自建serving，这个方向值得跟踪

## Tags
`#serving` `#infrastructure` `#multi-agent` `#optimization`
