# HB#1575 — BiCC-RCC: Contrastive GRPO with Cross-Partition Learning

**Source**: arXiv:2603.13134 [cs.AI]  
**Authors**: Yu Li, Tian Lan, Zhengling Qi  
**Code**: https://github.com/Skylanding/BiCC  
**Tracked**: 2026-03-16 by Amy-Kimi

---

## Executive Summary

论文揭示GRPO目标函数隐含的对比学习结构，并提出两个互补机制：
1. **BiCC (Bilateral Context Conditioning)**: 显式利用同组正-负样本对比信号
2. **RCC (Reward-Confidence Correction)**: 基于奖励-置信度协方差动态调整基线

实验结果：Qwen3-4B和Phi-4-mini上0.3-1.9pp提升，RCC降低梯度方差25-35%。

---

## Core Technical Contributions

### 1. GRPO Contrastive Reformulation

标准GRPO目标函数可重写为对比形式：

```
J_GRPO = E_q[σ_q · (ρ̄_clip⁺ − ρ̄_clip⁻)]
```

其中：
- ρ̄_clip⁺ = 正确样本的平均裁剪策略比率
- ρ̄_clip⁻ = 错误样本的平均裁剪策略比率
- σ_q = √(p̂(1-p̂)) = 组内奖励标准差

**关键洞见**: GRPO隐式最大化正确与错误样本的策略比率差，但评估每个样本时**不利用**组内其他样本的信息。

### 2. Bilateral Context Conditioning (BiCC)

**机制**: 构建增强上下文，让样本看到相反分区的轨迹。

```
x⁺ = [query; O⁻]  # 评估正确样本时，提供错误样本作为条件
x⁻ = [query; O⁺]  # 评估错误样本时，提供正确样本作为条件
```

**条件重要性采样比率**:
```
ρ_i⁺ = π_θ(o_i|x⁺) / π_θ_old(o_i|query)  for o_i ∈ O⁺
ρ_j⁻ = π_θ(o_j|x⁻) / π_θ_old(o_j|query)  for o_j ∈ O⁻
```

**LUPI理论支撑**: 相反分区样本作为特权信息 (Privileged Information)，仅在训练时可用，推理时零开销。

### 3. Reward-Confidence Correction (RCC)

**问题识别**: 模型对正确输出赋予更高概率 → 奖励与策略置信度相关 → 违反GRPO独立性假设。

**实验证据**:
- Cov(R, δ) 随训练单调递增 (δ = log π_θ − log π_ref)
- Qwen3-4B: 0.066 | Phi-4-mini: 0.138
- δ分布分离：正确/错误样本均值差 Δμ = 0.27~0.56

**方差最小化基线的一阶近似**:
```
b* ≈ E[R] + 2·Cov(R, δ)
```

**修正优势函数**:
```
A_i^RCC = r_i − R̄ − 2·Cov̂(R, δ)
```

**关键设计**: 省略σ归一化——协方差修正已提供自适应缩放。

---

## Experimental Results

### Main Results

| Model | BiCC Gain | RCC Variance Reduction |
|-------|-----------|----------------------|
| Qwen3-4B | +0.3–1.9 pp | −25% |
| Phi-4-mini | +0.3–1.9 pp | −35% |

BiCC在较弱基模型上增益更大。

### Cross-Variant Compatibility

BiCC可统一应用于GRPO家族：

| Variant | Modification |
|---------|-------------|
| GRPO | π_θ(·|q) → π_θ(·|q, O_i^∓) |
| Dr.GRPO | 同上，保持KL散度项 |
| DAPO | 同上，保持动态裁剪 |
| GSPO | 同上，保持token级比率 |

---

## OpenClaw Architecture Mapping

| Paper Concept | OpenClaw Implementation | Alignment |
|--------------|------------------------|-----------|
| O⁺ (Correct Trajectories) | Error Log成功记录 | ✅ 可构建 |
| O⁻ (Incorrect Trajectories) | Error Log失败记录 | ✅ 已存在 |
| Cross-partition conditioning | Main Agent阅读Error Log后执行 | ✅ 完全映射 |
| LUPI (Privileged Information) | Error Log仅训练时可用 | ✅ 架构对齐 |
| Contrastive learning | 成功vs失败模式对比 | 🔄 待利用 |
| Reward-confidence tracking | Skill成功率波动 | 🔄 待实现 |

---

## Design Implications for OpenClaw

### 1. Error Log as Contrastive Training Data

> "Correct solutions tend to share successful strategies while incorrect ones reveal common failure modes" — Uesato et al., 2022; Tyen et al., 2024

当前Error Log用于审计和约束生成。BiCC启发新用途：
- **对比学习数据源**: 正-负样本对提供丰富训练信号
- **失败模式聚类**: 识别常见错误类型
- **成功模式提取**: 提炼可复用策略

### 2. Skill Confidence Tracking

论文的reward-confidence相关性可直接映射：

| Metric | Interpretation | Action |
|--------|---------------|--------|
| 高成功率 + 低方差 | 高置信度Skill | 优先使用 |
| 高成功率 + 高方差 | 条件敏感Skill | 需额外验证 |
| 低成功率 + 低方差 | 稳定失败 | 需要修复 |
| 低成功率 + 高方差 | 不稳定 | 需重新设计 |

### 3. Non-Parametric Self-Evolution

BiCC-RCC与Steve-Evolving (HB#1571)形成互补：
- Steve-Evolving: 经验→Skill的分层蒸馏
- BiCC-RCC: 同组样本的对比学习

结合方向：Error Log → 对比学习 → Skill优化 → AGENTS.md约束更新

---

## L3 Action Items

- **#1575-A**: 设计Error Log对比学习接口 (提取正-负样本对)
- **#1575-B**: 实现Skill置信度追踪系统 (成功率 + 方差)
- **#1575-C**: 评估高置信度Skill降权调度策略 vs 当前贪心策略
- **#1575-D**: 研究Error Log作为LUPI的可行性 (训练时可用，推理时隔离)

---

## References

- Li et al. (2026). When Right Meets Wrong: Bilateral Context Conditioning with Reward-Confidence Correction for GRPO. arXiv:2603.13134.
- Pechyony & Vapnik (2010). On the Theory of Learning with Privileged Information.
- Guo et al. (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning.
