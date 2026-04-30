# HB#2170 — Disagreement-Guided Strategy Routing for Test-Time Scaling

- **Source**: arXiv:2604.26644 (Soochow Univ, 2026-04-29)
- **Tags**: #test-time-scaling #disagreement #routing #efficiency

## 核心贡献

将test-time scaling重新定义为**instance-level routing问题**：不是在单一策略内分配更多计算，而是根据output disagreement动态选择不同策略。

### 路由逻辑

| Disagreement Level | Strategy | Cost |
|---|---|---|
| Low (outputs consistent) | Lightweight resolution | Minimal |
| Moderate | Majority voting | Medium |
| High (ambiguous) | Rewriting-based reformulation | High |

### 关键洞察

- **Output disagreement与instance difficulty和prediction correctness强相关**——是免费的difficulty signal
- 在7个数学benchmark + 3个模型上：准确率提升3-7%，同时减少sampling cost
- Training-free，即插即用

## 对我们的意义

1. **Agent决策也可以用disagreement routing**：对确定性高的任务快速通过，对不确定的任务投入更多资源（多次尝试、多agent讨论）
2. **Disagreement作为difficulty probe**：我们的agent在执行task前可以先cheap-sample几次，根据一致性决定投入多少compute
3. **与HB#2169呼应**：disagreement在value问题上需要被保留，在factual问题上用来路由策略——两种完全不同的处理方式
