# HB-260810: ML Intern 完成后训练实习测试 —— Test-Time Compute Scaling验证

> **Date**: 2026-04-23 (HF Blog)  
> **Source**: Hugging Face Blog / Carlos Miguel Patiño  
> **Tags**: #test-time-compute #best-of-n #process-reward-model #ml-intern #math-reasoning  
> **Significance**: ★★★★★

---

## 核心发现

**ML Intern** (smolagents/ml-intern)——一个AI Agent——完成了HuggingFace实习生的后训练拿回家测试，验证了**Test-Time Compute Scaling**的实际效果：

| 方法 | 准确率 | 相比Greedy提升 |
|------|--------|----------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

**关键洞察**: 仅1.5B参数的小模型 + PRM，通过Test-Time Compute Scaling超越大模型性能。

---

## 技术细节

### 模型配置
- **Generator**: Qwen2.5-1.5B-Instruct (1.5B参数)
- **Process Reward Model**: Skywork-o1-Open-PRM-Qwen-2.5-1.5B (1.5B参数)
- **总参数量**: 仅3B (1.5B + 1.5B)

### Best-of-N Weighted Selection流程

```
1. 对每个问题采样N个独立解 (N=1→16)
2. 用PRM为每个解的每一步打分
3. 取最后一步分数作为整体奖励
4. 按最终答案分组，累加组内PRM分数
5. 选择总加权分数最高的答案
```

数学表达:
```
â = argmax_a Σ(i=1 to N) 1(a_i=a) · score(s_i)
```

### 为什么Weighted > Standard Best-of-N?

**Standard BoN**: 选单个PRM分数最高的解  
→ 可能被单个高分错误解欺骗

**Weighted BoN**: 同一正确答案在多个解中出现，通过累加PRM分数积累证据  
→ 更鲁棒，避免被离群高分离群点误导

**案例**: number_theory/22问题
- 正确答案"2"仅出现在5/16个样本中
- 但加权投票仍选出了正确答案
- Standard Best-of-N在此失败

---

## 扩展曲线分析

| N值 | Weighted BoN准确率 |
|-----|-------------------|
| N=1 | 51.5% |
| N=2 | 58% |
| N=4 | 63.6% |
| N=8 | 65.3% |
| N=16 | 65% |

**饱和点**: N=8-16时性能饱和，继续增加样本数收益递减。

---

## 关键设计决策

### 1. 为什么用最后一步PRM分数?

Skywork PRM每步都输出分数，但测试采用**仅最后一步**作为整体奖励。

原因: PRM用soft Monte Carlo return labels训练，最后一步已整合完整解轨迹信息。(DeepMind Appendix E)

### 2. PRM分数分布

PRM有效分离正确与错误解:
- 正确解分数聚类在较高区间
- 错误解分数普遍较低

### 3. 答案匹配的局限

当前用精确字符串匹配，导致LaTeX格式差异被误判:
- `\frac43` vs `\frac{4}{3}` (数学等价)
- `4210_{5}` vs `4210_5` (仅空格差异)

**提升空间**: 加入SymPy归一化可进一步提高所有方法准确率。

---

## 对OpenClaw的意义

### ✅ 已验证的方向

1. **小模型+策略 > 裸大模型**
   - 3B总量 (1.5B+1.5B PRM) 达到65% MATH-500
   - 验证"架构创新 > 暴力参数"方向

2. **Weighted投票机制**
   - 多候选结果加权聚合比单选更鲁棒
   - 可迁移到Skill选择: 多候选Skill结果 → PRM打分 → 加权选择

3. **Test-Time Compute Scaling**
   - 无需重训练即可显著提升性能
   - N=8-16为性价比甜点

### ⚠️ 待实现的机制

1. **PRM基础设施**
   - 缺乏用于代码/工具调用轨迹评估的PRM
   - 需研究: 如何为Agent执行轨迹设计Process Reward Model

2. **Answer Normalization**
   - Skill结果的标准化比较机制
   - 避免格式差异导致的假阴性

3. **动态N选择**
   - 根据任务复杂度自适应选择N值
   - 简单任务N=2-4，复杂任务N=8-16

---

## 原始资源

- **Blog Post**: https://huggingface.co/blog/cmpatino/ml-intern-takehome
- **ML Intern Space**: https://huggingface.co/spaces/smolagents/ml-intern
- **Take-Home Exercise**: https://github.com/huggingface/post-training-takehome
- **Results Dataset**: cmpatino/math500-bon-weighted-results
- **Execution Space**: cmpatino/math500-bon-exercise

---

## 引用论文

1. **Scaling LLM Test-Time Compute** (DeepMind, 2408.03314) — Section 5.1 + Appendix E
2. **Math-Shepherd** (2312.08935) — Section 3.4, Eq. 5

---

## 相关发现

- [HB-260709-ml-intern-test-time-compute](HB-260709-ml-intern-test-time-compute.md) — 前期报道
- [HB-260801-hf-april-agent-roundup](HB-260801-hf-april-agent-roundup.md) — 同期HF博客综述
- [HB-260708-ml-intern-test-time-compute](HB-260708-ml-intern-test-time-compute.md) — 详细技术分析
