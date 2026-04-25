# ML Intern: Best-of-N Weighted Selection 验证 Test-Time Compute 缩放

**来源**: Hugging Face Blog (Apr 23, 2026)  
**作者**: Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall  
**链接**: https://huggingface.co/blog/cmpatino/ml-intern-takehome

---

## 核心发现

ml-intern (一个基于 smolagents 的AI实习生代理) 完成了 Hugging Face 博士后实习笔试题，验证了 **Test-Time Compute Scaling** 的有效性：

| 方法 | MATH-500 准确率 | 相比 Greedy 提升 |
|------|----------------|-----------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

**关键洞察**: 1.5B Qwen2.5 + Skywork PRM 通过加权投票策略，在不重新训练模型的情况下，将数学推理能力从 45% 提升到 65%。

---

## 技术方案

**Best-of-N Weighted Selection 流程**:
1. 对每个问题采样 N 个独立解答 (N=16)
2. 使用 Process Reward Model (PRM) 为每个解答打分（取最后一步预测作为最终奖励）
3. 按最终答案分组，累加每组 PRM 分数（加权投票）
4. 选择总分最高的答案

**为什么 Weighted Selection > Standard Best-of-N?**
- Standard Best-of-N: 选择单个 PRM 分数最高的解答 → 可能被单个高分离群点欺骗
- Weighted Selection: 正确答案在多个解答中出现会累积证据 → 更鲁棒

**实际案例**: 在 number_theory/22 问题中，正确答案 "2" 只出现在 5/16 样本中，但加权投票击败了多数投票法。

---

## PRM 设计决策

**为什么使用最后一步预测？**
- Skywork PRM 在每个推理步骤输出分数
- 遵循 DeepMind 论文 Appendix E: 使用最后一步分数作为完整解答奖励
- 原因：PRM 使用软蒙特卡洛返回标签训练 → 最后一步已整合完整解答轨迹信息

**答案匹配局限性**:
- 当前使用精确字符串匹配（无 SymPy 归一化）
- 导致假阴性：\frac43 vs \frac{4}{3}、4210_{5} vs 4210_5、(5,\infty) vs (5, \infty)
- 适当归一化后所有方法准确率会更高

---

## 对 OpenClaw 的意义

### ✅ 可直接应用
- **多候选 Skill 结果的加权选择**: 当多个 skill 执行路径产生不同结果时，可实现加权投票机制选择最优解
- **Test-time compute scaling**: 无需重训练即可通过增加采样提升性能

### ⚠️ 待解决问题
- **缺乏 PRM 基础设施**: 当前没有 process reward model 用于代码/工具调用轨迹评估
- **答案归一化**: 需要 SymPy 等工具减少假阴性匹配
- **成本权衡**: N=16 意味着 16x 推理成本，需评估经济性

---

## 参考资源

- **论文**: Scaling LLM Test-Time Compute (DeepMind, 2408.03314)
- **数据集**: cmpatino/math500-bon-weighted-results
- **执行空间**: cmpatino/math500-bon-exercise (Docker Space on T4 GPU)
- **HF Blog**: Scaling Test-Time Compute with Open Models
- **模型**: Qwen/Qwen2.5-1.5B-Instruct + Skywork/Skywork-o1-Open-PRM-Qwen-2.5-1.5B

---

*标签: #test-time-compute #best-of-n #process-reward-model #math-reasoning #qwen #scaling*