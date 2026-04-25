# HB-260425: ML Intern — Best-of-N Weighted Selection验证Test-Time Compute缩放

**Source**: Hugging Face Blog (Apr 23, 2026)  
**Authors**: Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall  
**URL**: https://huggingface.co/blog/cmpatino/ml-intern-takehome  
**Type**: Empirical Validation / Methodology  
**Rating**: ★★★★★

## Core Insight

> "Weighted Best-of-N: 1.5B模型 + PRM在MATH-500达到65%（vs贪婪解码45%），无需重新训练即可实现test-time compute缩放。"

ML Intern (smolagents) 完成Hugging Face实习生post-training测试，验证了Test-Time Compute Scaling的实际效果。

## Method: Best-of-N Weighted Selection

基于DeepMind (2408.03314) 的方法：

1. **采样**: 从LLM采样N个独立解
2. **打分**: 用Process Reward Model (PRM) 对每个解打分（取最后一步预测作为最终reward）
3. **分组加权**: 按最终答案分组，每组内累加PRM分数
4. **选择**: 选择总分最高的答案

公式: `â = argmax_a Σᵢ 1(aᵢ=a) · score(sᵢ)`

## Models Used

| Model | Role | Size |
|-------|------|------|
| Qwen2.5-1.5B-Instruct | 解生成器 (LLM) | 1.5B |
| Skywork-o1-Open-PRM-Qwen-2.5-1.5B | Process Reward Model | 1.5B |

## Results on MATH-500 (20题样本)

| Method | Accuracy | Improvement |
|--------|----------|-------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

## Accuracy vs N Scaling

| N | Weighted BoN Accuracy |
|---|----------------------|
| 1 | 51.5% |
| 2 | 58% |
| 4 | 63.6% |
| 8 | 65.3% |
| 16 | 65% |

**关键发现**: 性能在N=8-16时达到平台期，边际收益递减。

## Why Weighted > Standard Best-of-N?

**Standard BoN**: 选择单条PRM分数最高的解 → 可能被单个高分错误解欺骗

**Weighted Selection**: 正确答案在多个解中出现时，通过累加PRM分数积累证据 → 更鲁棒

典型案例: number_theory/22题，正确答案"2"只在5/16样本中出现，但通过加权投票获胜。

## PRM Score Distribution

PRM有效区分正确与错误解：
- 正确解聚集在高分数区域
- 错误解分布在低分数区域

## Key Design Decisions

### Why Last-Step Prediction?
Skywork PRM每步都输出分数。根据DeepMind附录E，只用最后一步分数作为完整解reward（而非所有步的最小值或乘积），因为PRM是用soft Monte Carlo return标签训练的——最后一步已整合完整解轨迹信息。

### Answer Matching Limitations
使用精确字符串匹配（无SymPy归一化），导致一些因LaTeX格式差异被判错：
- `\frac43` vs `\frac{4}{3}`
- `4210_{5}` vs `4210_5`
- `(5,\infty)` vs `(5, \infty)`

适当归一化后所有方法准确率会更高。

## 对 OpenClaw 的意义

- ✅ 可集成多候选Skill结果的加权选择机制
- ✅ Test-time compute scaling无需重训练即可提升性能
- ⚠️ 缺乏用于代码/工具调用轨迹评估的PRM基础设施
- ⚠️ Answer normalization（SymPy）可减少假阴性

## Related
- [HB-260425-thinking-skills-acl2026.md](HB-260425-thinking-skills-acl2026.md) — 推理技能蒸馏
- [HB-260425-vakra-ibm-agent-benchmark.md](HB-260425-vakra-ibm-agent-benchmark.md) — 企业级Agent评估

## Tags
#test-time-compute #best-of-n #prm #qwen #math-reasoning #weighted-voting
