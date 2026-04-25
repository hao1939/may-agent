# ML Intern: Best-of-N Weighted Selection验证Test-Time Compute缩放

**来源**: Hugging Face Blog (Apr 23, 2026) — Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall
**链接**: https://huggingface.co/blog/cmpatino/ml-intern-takehome
**评分**: ★★★★★

## 核心发现

当ml-intern (AI Agent)参加HuggingFace人类实习生的post-training测试时，取得了惊人结果：**1.5B Qwen2.5 + Skywork PRM通过Weighted Best-of-N在MATH-500达到65%**（vs贪婪解码45%）。

## 技术方案

### Best-of-N Weighted Selection流程
1. 从LLM采样N个独立解
2. 用Process Reward Model (PRM)为每个解打分（取最后一步预测作为最终奖励）
3. 按最终答案分组，累加每组PRM分数（加权投票）
4. 选择总分最高的答案

公式: `â = argmax_a Σ 1(a_i=a) · score(s_i)`

### 模型配置
| 模型 | 角色 | 参数量 |
|------|------|--------|
| Qwen2.5-1.5B-Instruct | 解生成器 | 1.5B |
| Skywork-o1-Open-PRM-Qwen-2.5-1.5B | 过程奖励模型 | 1.5B |
| **总计** | | **3B** |

## 性能对比

| 方法 | 准确率 | 相比贪婪改进 |
|------|--------|--------------|
| 贪婪解码 (N=1) | 45% | — |
| 多数投票 (N=16) | 60% | +15pp |
| 标准Best-of-N (N=16) | 55% | +10pp |
| **加权Best-of-N (N=16)** | **65%** | **+20pp** |

### N值与准确率关系
N=1: 51.5% → N=2: 58% → N=4: 63.6% → N=8: 65.3% → N=16: 65%

**饱和点**: N=8-16时性能饱和，继续增加收益递减。

## 关键设计决策

### 为什么用最后一步预测？
Skywork PRM在每一步输出分数。遵循DeepMind附录E，仅使用最后一步分数作为完整解奖励（而非所有步骤的最小值或乘积）。这是因为PRM用软蒙特卡洛返回标签训练——最后一步已整合完整解轨迹信息。

### 为什么加权选择 > 标准Best-of-N？
标准Best-of-N选择单最高PRM分数解，可能被单个高分错误解欺骗。加权选择更鲁棒：出现在多个解中的正确答案通过累加PRM分数积累证据。

典型案例：number_theory/22题，正确答案"2"仅出现在5/16样本中，但加权投票胜过多数投票。

### 答案匹配局限
使用精确字符串匹配（无SymPy归一化），导致LaTeX格式差异被标记为错误：
- `\frac43` vs `\frac{4}{3}` — 数学等价
- `4210_{5}` vs `4210_5` — 仅空格差异

适当归一化后所有方法准确率会更高。

## 对 OpenClaw 的意义

### ✅ 可集成机制
- **多候选Skill结果加权选择**: 当多个Skill可处理同一意图时，采样多个执行路径，用轻量级评估器加权选择
- **Test-time compute缩放**: 3B总量模型可竞争100B+模型，验证Skill化方向正确

### ⚠️ 基础设施缺口
- 缺乏用于代码/工具调用轨迹评估的PRM基础设施
- Answer normalization（SymPy）可减少假阴性
- 需要轻量级评估器（类似PRM）用于Skill执行质量判断

## 相关资源

- 结果数据集: cmpatino/math500-bon-weighted-results
- 执行Space: cmpatino/math500-bon-exercise
- DeepMind论文: Scaling LLM Test-Time Compute (2408.03314)
- Skywork PRM推理: github.com/SkyworkAI/skywork-o1-prm-inference
