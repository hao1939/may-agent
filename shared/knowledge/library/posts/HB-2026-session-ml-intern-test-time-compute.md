# ML Intern: Test-Time Compute Scaling 实战验证

**来源**: Hugging Face Blog (April 23, 2026) — Carlos Miguel Patiño et al.  
**标签**: `Test-Time Compute`, `Process Reward Model`, `Best-of-N`, `Small Models`  
**置信度**: ★★★★★

---

## 核心发现

**3B 总参数 (1.5B Qwen + 1.5B PRM) → 65% MATH-500**

- 贪婪解码基线: 45%
- Weighted Best-of-N (N=16): **65%** (+20pp)
- 性能饱和点: **N=8-16**

---

## 技术方案

### Weighted Best-of-N 算法

```
a* = argmax_a Σ(1(ai=a) · score(si))
```

1. **采样**: 每道题从 LLM 采样 N 个独立解答
2. **评分**: 用 PRM (Process Reward Model) 为每个解答打分（取最后一步预测）
3. **分组加权**: 按最终答案分组，累加 PRM 分数
4. **选择**: 选择总分最高的答案组

### 模型配置

| 模型 | 角色 | 参数量 |
|------|------|--------|
| Qwen2.5-1.5B-Instruct | 解答生成器 | 1.5B |
| Skywork-o1-Open-PRM-Qwen-2.5-1.5B | 过程奖励模型 | 1.5B |
| **总计** | | **3B** |

---

## 实验结果

### 不同方法对比

| 方法 | 准确率 | 相对提升 |
|------|--------|----------|
| 贪婪解码 (N=1) | 45% | — |
| 多数投票 (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

### N 值与准确率关系

| N | Weighted Best-of-N 准确率 |
|---|---------------------------|
| 1 | 51.5% |
| 2 | 58% |
| 4 | 63.6% |
| 8 | 65.3% |
| 16 | 65% |

**关键洞察**: N=8-16 是成本效益最佳点，继续增加采样数收益递减。

---

## 关键设计决策

### 1. 为什么用最后一步预测？

Skywork PRM 在每一步推理都输出分数。遵循 DeepMind 论文 Appendix E，只使用最后一步分数作为完整解答奖励：

> PRM 使用软蒙特卡洛回报标签训练，最后一步已整合完整解答轨迹信息。

### 2. 为什么 Weighted > Standard Best-of-N？

- **Standard**: 选择单个 PRM 分数最高的解答
  - 风险: 单一高分的错误解答可能误导
- **Weighted**: 正确答案在多个解答中出现时，通过累加 PRM 分数积累证据
  - 案例: `number_theory/22` 正确答案仅出现在 5/16 样本中，但加权投票胜出

### 3. PRM 分数分布

PRM 有效分离正确与错误解答——正确答案集中在高分区域。

---

## 对 OpenClaw 的意义

### ✅ Test-Time Compute 验证

**小模型 + 策略 > 大模型贪婪解码**:
- 1.5B 参数 + Best-of-N = 65% MATH-500
- 验证了推理时计算扩展的有效性

**对 Skill 执行的启示**:
- 关键 Skill 可并行执行 N 次 (N=8-16)，加权选择结果
- 比单次执行大模型更可靠、成本可能更低

### 🔬 PRM 基础设施缺口

**缺失组件**: 代码/工具调用轨迹的过程奖励模型

**机会**:
- 基于 Error Log 构建 PRM 训练数据
- 开发 Skill 执行质量评估的 PRM
- Weighted aggregation 集成到 Skill 执行管道

### ⚠️ 成本权衡

**N=8-16 是甜点**:
- N=1 → N=8: 准确率 51.5% → 65.3%（+13.8pp）
- N=8 → N=16: 几乎无提升
- 8x 推理成本 vs +14pp 准确率提升 —— 对关键任务值得

### 💡 实施建议

1. **Skill 级别配置**: 允许为关键 Skill 设置 `n_samples` 参数
2. **自适应采样**: 简单任务 N=1，复杂任务自动提升到 N=8
3. **结果聚合**: 实现 weighted voting 机制（基于执行轨迹评分）
4. **PRM 开发**: 优先开发通用 Skill 执行质量评估模型

---

## 关键引用

> "Weighted selection is more robust: a correct answer appearing in multiple solutions accumulates evidence through summed PRM scores."

> "Performance plateaus around N=8-16, establishing a cost-effective 'sweet spot'."

---

## 相关链接

- 原文: https://huggingface.co/blog/cmpatino/ml-intern-takehome
- 代码仓库: https://huggingface.co/cmpatino/math500-bon-exercise
- 结果数据集: https://huggingface.co/datasets/cmpatino/math500-bon-weighted-results
- DeepMind 论文 (2408.03314): Scaling LLM Test-Time Compute
- Math-Shepherd 论文 (2312.08935)
- HF Blog: Scaling Test-Time Compute with Open Models
