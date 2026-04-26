# HB-260526: GoModel — Go 语言 AI 网关 (LiteLLM 替代品)

## 基本信息
- **来源**: Hacker News (213 points, 75 comments, #4 on HN)
- **项目**: GoModel (github.com/ENTERPILOT/GoModel)
- **作者**: ENTERPILOT
- **标签**: 666⭐, Go语言, AI Gateway
- **时间**: 2026-04-21

## 核心定位

> "A fast and lightweight AI gateway written in Go, providing a unified OpenAI-compatible API"

GoModel 是 LiteLLM 的 Go 语言替代品，提供：
- 统一 OpenAI 兼容 API
- 多提供商支持
- 可观测性和成本追踪
- 轻量级高性能

## 支持的模型提供商

- OpenAI
- Anthropic (Claude)
- Google (Gemini)
- xAI (Grok)
- Groq
- OpenRouter
- Z.ai
- Azure OpenAI
- Oracle
- Ollama (本地模型)
- 更多...

## 核心功能

### 统一 API 层
```
客户端 → OpenAI 格式请求 → GoModel → 路由到不同提供商 → 统一格式响应
```

### 可观测性
- Token 使用量追踪
- 成本监控和估算
- 请求延迟统计
- Dashboard 可视化

### 企业级特性
- Guardrails (内容防护)
- Streaming 支持
- 负载均衡
- 容错和重试

### 部署方式
- Docker / Docker Compose
- Kubernetes (Helm charts)
- 二进制直接部署
- Prometheus 指标导出

## 对 OpenClaw 的意义

### ✅ 多模型战略
- **供应商解耦**: 通过网关统一接入多模型后端
- **成本优化**: 支持路由到成本最优的提供商
- **本地部署**: Ollama 支持实现完全私有化

### 🔬 架构参考
- **网关模式**: OpenClaw 是否应内置模型网关？
- **Go 语言栈**: 与 OpenClaw 的 Go 实现一致，可借鉴代码
- **可观测性**: Token/成本追踪是生产级必备

### ⚠️ 差异化思考
- **LiteLLM vs GoModel**: Python vs Go，性能 vs 生态
- **自研 vs 集成**: 是否直接使用 GoModel 作为模型层？
- **功能边界**: Gateway 提供哪些 OpenClaw 独有的功能？

## Critical Questions

1. **模型层架构**: OpenClaw 是直接调用模型还是通过网关？
2. **多供应商**: 是否应原生支持多模型后端自动切换？
3. **成本追踪**: Workflow 执行的模型成本如何追踪和优化？
4. **本地模型**: Ollama/llama.cpp 集成优先级如何？
5. **网关依赖**: 是否应将 GoModel 作为推荐部署组件？

## 部署示例

```yaml
# docker-compose.yaml
version: '3'
services:
  gomodel:
    image: enterpilot/gomodel:latest
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## 相关链接
- GitHub: https://github.com/ENTERPILOT/GoModel
- 文档: https://gomodel.enterpilot.io/docs
- HN 讨论: https://news.ycombinator.com/item?id=47849097
