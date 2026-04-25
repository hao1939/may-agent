# ML Intern Takes Our Post-Training Internship Test

**来源**: Hugging Face Blog (Apr 23, 2026)  
**链接**: https://huggingface.co/blog/cmpatino/ml-intern-takehome  
**类型**: Test-Time Compute / Process Reward Models  
**HB ID**: HB-260425-ml-intern-test-time-compute

## 核心发现

HF 的 ml-intern (AI agent) 完成了人类实习生的 post-training 测试题——复现 Best-of-N Weighted Selection 在 MATH-500 上的基线。

### 技术方案

**Best-of-N Weighted Selection** (DeepMind 2408.03314):
- 对每个问题采样 N 个独立解
- 用 Process Reward Model (PRM) 给每个解打分（取最后一步预测作为最终奖励）
- 按最终答案分组，累加每组 PRM 分数（加权投票）
- 选择总分最高的答案

公式: `â = argmax_a Σᵢ 1(aᵢ=a) · score(sᵢ)`

### 模型配置

| 模型 | 角色 | 参数量 |
|------|------|--------|
| Qwen/Qwen2.5-1.5B-Instruct | 解生成器 | 1.5B |
| Skywork/Skywork-o1-Open-PRM-Qwen-2.5-1.5B | PRM 打分器 | 1.5B |

### 实验结果 (MATH-500, 20题子集)

| 方法 | 准确率 | 相比 Greedy 提升 |
|------|--------|------------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

N 的缩放曲线: N=1(51.5%) → N=2(58%) → N=4(63.6%) → N=8(65.3%) → N=16(65%)，在 N=8-16 处饱和。

### 关键洞察

1. **Weighted > Standard Best-of-N**: 标准 BoN 选单个最高分解，可能被单个高分离群点欺骗。加权选择更鲁棒——正确答案在多个解中出现时可累积证据。

2. **Last-Step PRM 预测**: Skywork PRM 每步输出分数，但仅用最后一步作为全解奖励（DeepMind Appendix E）。因 PRM 用 soft Monte Carlo return 训练，最后一步已整合全轨迹信息。

3. **小模型的 test-time 缩放**: 1.5B 生成 + 1.5B PRM，通过增加采样数 (N=16) 可大幅提升性能。验证了 "inference-time compute scaling" 的有效性。

## 对 OpenClaw 的意义

- ✅ **验证 test-time compute 价值**: 采样多解 + PRM  reranking 可显著提升质量
- ✅ **Weighted voting 机制**: 可集成到 Skill 的多候选选择中
- ⚠️ **PRM 基础设施缺失**: 当前无 Process Reward Model 用于代码/工具调用轨迹评估
- ⚠️ **Answer normalization**: 简单字符串匹配导致假阴性（如 `\frac43` vs `\frac{4}{3}`），需引入 SymPy 归一化

## 资源

- 代码/结果: https://huggingface.co/datasets/cmpatino/math500-bon-weighted-results
- 在线演示: https://huggingface.co/spaces/cmpatino/ml-intern
- 参考论文: DeepMind 2408.03314 (Scaling LLM Test-Time Compute)

---
*Scraped by amy-kimi on 2026-04-25*
