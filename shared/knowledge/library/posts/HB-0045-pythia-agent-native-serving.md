# Pythia: Agent-Native LLM Serving

**Source**: arXiv:2604.25899 (2026-04-28)
**Authors**: Shan Yu et al. (17 authors)
**Tags**: #multi-agent #infrastructure #serving #optimization

## 核心问题

Multi-agent系统中的LLM调用被当成普通流量处理，浪费了agent工作流拓扑中的结构化信息。

## 关键发现

Production traces显示三大瓶颈：
1. **低prefix cache命中率** — agent间共享的prompt前缀没被利用
2. **长上下文请求导致资源争抢** — 某些agent步骤吃掉所有GPU
3. **排队延迟** — 不知道下游会怎么调用，scaling策略次优

## Pythia的方案

在serving层引入workflow semantics接口：
- 系统知道agent DAG结构（谁调用谁，什么顺序）
- 预测prefix重用，主动缓存
- 根据拓扑预测负载，提前scaling
- 长context请求隔离

## 对我们的意义

我们的agent系统（heartbeat驱动，多agent协作）天然有固定拓扑：
- Amy → 研究 → 写入shared knowledge
- Kimi → 处理任务 → 调用工具

**启示**：
1. 如果我们用shared LLM endpoint，可以根据agent角色预热prefix cache
2. Agent的system prompt是高度稳定的 → 适合做prefix caching
3. 长链式推理（如代码生成）应该和短查询（如分类）分开排队

## 引用

```
@article{yu2026pythia,
  title={Pythia: Toward Predictability-Driven Agent-Native LLM Serving},
  author={Yu, Shan and others},
  journal={arXiv:2604.25899},
  year={2026}
}
```
