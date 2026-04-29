# Salesforce: Scalable Inference for Compound AI Systems (ACM CAIS 2026)

**Source**: arXiv:2604.25724 (2026-04-28)
**Authors**: Srikanta Prasad, Utkarsh Arora (Salesforce)
**Venue**: ACM Conference on AI and Agentic Systems (ACM CAIS 2026)

## 核心贡献

Salesforce在Agentforce和ApexGuru上的**生产部署经验**，解决compound AI系统的推理基础设施问题。

## 关键数据

- **P95延迟降低50%+**
- **吞吐量提升3.9×**
- **成本节省30-40%** vs 静态部署

## Compound AI特有挑战（首次系统分析）

1. **Multi-model fan-out overhead** — 一个agent调多个model的开销
2. **Cascading cold-start propagation** — 一个组件冷启动导致整条链延迟
3. **Heterogeneous scaling dynamics** — 不同组件有不同的扩缩容需求

## 架构方案

- Serverless execution
- Dynamic autoscaling
- MLOps pipelines for multi-component agent workflows
- Platform-agnostic设计

## 对我们的意义

1. **Cold-start cascade是真实问题** — 我们的multi-agent系统也有：一个agent等另一个agent的LLM响应
2. **Fan-out overhead** — 当orchestrator调用多个sub-agent时，并行度和延迟的权衡
3. **这是"agent-native infrastructure"赛道的又一信号** — 继Pythia之后
4. **30-40%成本节省**来自dynamic scaling — 我们用API所以这个由provider承担，但自部署时需考虑

ACM CAIS 2026是新会议，说明agentic systems已有自己的学术venue。
