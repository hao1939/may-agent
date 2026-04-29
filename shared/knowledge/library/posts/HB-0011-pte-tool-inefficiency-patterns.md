# HB-0011: PTE — 工具调用效率的四种反模式

**来源**: 小红书 @nlper今天读paper了吗 → arXiv 2604.05404 (ACL 2026)
**论文**: "Beyond Accuracy: Unveiling Inefficiency Patterns in Tool-Integrated Reasoning"
**作者**: Qisheng Su et al. (USTC)
**代码**: https://github.com/sqs-ustc/tool-reasoning-framework-PTE
**日期**: 2026-04-29 收录

---

## 核心贡献

提出 **PTE (Prefill Token Equivalents)** — 首个面向硬件的统一效率指标，将 Prefill（算力密集）和 Decode（显存密集）统一度量。在 H200 集群压测中，PTE 与真实延迟相关性 r=0.925，远超传统 token 计数。

## 四种工具调用反模式

| 模式 | 描述 | 症状 |
|------|------|------|
| **Confirmatory** | 模型已有答案，仍调工具"复核" | 冗余首步计算 |
| **Tool-Mixing** | 无意义地在搜索/代码间切换 | workflow碎片化，正确率无提升 |
| **Lack of Priors** | 训练不足导致误用工具 | 空返回、无效步 |
| **Format Collapse** | 对工具Schema过度敏感 | 工具名微调即失效，重复失败 |

## 反直觉发现

**高PTE成本的轨迹正确率更低** — "过度思考"和"工具堆砌"不仅浪费算力，还伴随推理不确定性。

## 对我们系统的意义

我们的 multi-agent 系统天然是 tool-integrated reasoning：每个 agent 频繁调用 bash、read、edit 等工具。这篇论文直接适用：

1. **Confirmatory 调用**: 我们是否在 agent 已知答案时仍做冗余验证？例如 read() 后再 grep 确认同一信息。应设计 "confidence threshold" — 够确定就不再验证。
2. **Tool-Mixing**: agent 是否在 read/bash/scrape 间无意义切换？可监控工具切换频率作为效率指标。
3. **Format Collapse**: 我们的工具 schema 变更是否会导致 agent 反复失败？需要 schema 稳定性保证。
4. **PTE 作为内部指标**: 可以用类似思路度量我们 agent 的"每次工具调用真实成本" — 不是 token 数，而是上下文膨胀导致的延迟。

**假设**: 减少 confirmatory 调用 + 压缩工具返回长度，可将 agent 单任务延迟降低 20-40%。
