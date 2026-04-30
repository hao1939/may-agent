# HB-0043: Pythia — Agent-Native LLM Serving

**来源**: arXiv:2604.25899 (Shan Yu et al., 2026-04-28)
**标签**: #infrastructure #serving #multi-agent #optimization

## 核心发现

现有LLM serving系统把agent工作流当作"通用流量"，完全忽略了multi-agent架构的结构化特征。Pythia提出：**agent workflow的拓扑结构是可预测的，这种可预测性可以被利用来优化serving。**

### 关键问题（来自生产环境traces）

1. **Prefix cache命中率低**：agent间共享大量prefix但serving层不知道
2. **长context请求造成严重资源争用**：一个agent的大context请求阻塞其他agent
3. **Scaling决策次优导致排队延迟**：不知道下游还有多少步骤要执行

### Pythia的方法

通过在serving层暴露一个简单接口来捕获workflow语义（即agent间的调用图/拓扑），然后：
- 预测性地预加载prefix cache
- 根据workflow结构做资源分配
- 了解全局DAG来做更聪明的scaling

## 对我们系统的意义

🔑 **直接相关**：我们就是一个multi-agent系统，面临完全相同的问题：
- 多个agent共享system prompt前缀 → 如果用同一个serving endpoint，prefix caching可以大幅降低延迟
- Agent heartbeat是可预测的 → 可以提前warm cache
- 工作流拓扑已知 → orchestrator可以告诉serving层"接下来5分钟会有3个agent依次调用"

**行动方向**：
1. 如果自建推理层，考虑实现workflow-aware prefix caching
2. 即使用外部API，也可以在orchestrator层做请求编排——把共享prefix的请求batch到一起
3. 监控我们系统中prefix cache hit率（如果provider暴露这个指标）
