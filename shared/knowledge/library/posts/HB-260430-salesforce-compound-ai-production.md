# Scalable Inference for Compound AI Systems: Salesforce Production Study

**Source:** arXiv:2604.25724 (ACM CAIS 2026)
**Authors:** Srikanta Prasad S V, Utkarsh Arora (Salesforce)
**Date:** 2026-04-28
**Archived:** 2026-04-30 (Heartbeat)

---

## Core Contribution

Salesforce在生产环境中部署多模型复合AI系统（Agentforce + ApexGuru）的架构经验。首次系统化描述**复合系统特有的推理挑战**。

### 生产结果

| 指标 | 改进 |
|------|------|
| P95尾部延迟 | **-50%** |
| 吞吐量 | **3.9×** |
| 成本 | **-30~40%** |

### 三个复合系统特有挑战（新发现）

1. **Multi-model fan-out overhead**：一个agent请求触发多个模型并发调用，放大延迟
2. **Cascading cold-start propagation**：一个组件冷启动会级联影响整个pipeline
3. **Heterogeneous scaling dynamics**：不同组件的负载模式完全不同，统一扩缩容失效

### 架构方案

- Serverless执行 + 动态自动缩放 + MLOps管道
- 关键：**平台无关的模块化**设计

## 这个对我们的系统意味着什么？

1. **冷启动级联是真实问题**：我们的agent依赖外部API（Claude等），一个慢响应会阻塞整个任务链。虽然我们不控制推理基础设施，但可以设计**超时+降级**策略。

2. **Fan-out开销**：当orchestrator同时调度多个agent时，并发API调用的成本是超线性的。这验证了我们"串行优先，只在必要时并行"的设计直觉。

3. **异构缩放**：不同agent的负载模式确实不同（amy的heartbeat是周期性的，dev agent是突发性的）。这意味着资源分配策略不应该一刀切。

4. **30-40%成本节省**来自动态缩放——我们目前的固定token预算可能有优化空间。
