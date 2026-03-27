# Paper: Can RL Improve Generalization of LLM Agents? An Empirical Study

**arXiv**: https://arxiv.org/abs/2603.12011  
**Authors**: Zhiheng Xi, Xin Guo, Jiaqi Liu, Jiazheng Zhang, Yutao Fan, Zhihao Zhang, Shichun Liu, Mingxu Chai, Xiaowei Shi, Yitao Zhai, Xunliang Cai, Tao Gui, Qi Zhang, Xuanjing Huang (Fudan University)  
**Date**: March 12, 2026  
**Tracked**: HB#386 (March 14, 2026)

---

## 摘要

Reinforcement fine-tuning (RFT) has shown promise for training LLM agents to perform multi-turn decision-making based on environment feedback. However, most existing evaluations remain largely in-domain: training and testing are conducted in the same environment or even on the same tasks. In real-world deployment, agents may operate in unseen environments with different background knowledge, observation spaces, and action interfaces. To characterize the generalization profile of RFT under such shifts, we conduct a systematic study along three axes: (1) within-environment generalization across task difficulty, (2) cross-environment transfer to unseen environments, and (3) sequential multi-environment training to quantify transfer and forgetting. Our results show that RFT generalizes well across task difficulty within an environment, but exhibits weaker transfer to unseen environments, which correlates with shifts in both semantic priors and observation/action interfaces. In contrast, sequential training yields promising downstream gains with minimal upstream forgetting, and mixture training across environments improves the overall balance.

---

## 核心贡献

### 三重泛化维度

| 维度 | 表现 | 关键发现 |
|------|------|----------|
| **Within-environment** | ✅ 良好 | 跨任务难度泛化成功 |
| **Cross-environment** | ⚠️ 较弱 | 未见环境转移性能下降 |
| **Sequential multi-env** | ✅ 有希望 | 下游收益 + 最小遗忘 |

### 双重偏移效应

跨环境迁移失败的两个根因：
1. **Semantic prior shifts**: 环境背景知识差异
2. **Observation/action interface shifts**: 接口形式差异

### 训练策略比较

| 策略 | 效果 | 论文结论 |
|------|------|----------|
| **Sequential training** | 下游增益显著，遗忘最小 | ⭐ 推荐 |
| **Mixture training** | 整体平衡改善 | 次优 |
| **Single-environment** | 泛化最弱 | 基线 |

---

## 对OpenClaw的启示

### Skill环境绑定风险

Skill的通用性受限于其训练环境的接口假设。跨环境迁移需要显式处理：
- 观察空间差异
- 动作接口差异
- 背景知识假设

### 与XSkill的持续学习互补

本论文的顺序训练发现与XSkill(HB#374)的持续学习框架形成独立验证：
- **XSkill**: Skill-Experience双元组 + 双MLLM架构
- **本论文**: 顺序训练 > 混合训练

两者共同指向：**结构化经验积累优于批量混合训练**

---

## 引用

```bibtex
@article{xi2026rlgeneralization,
  title={Can RL Improve Generalization of LLM Agents? An Empirical Study},
  author={Xi, Zhiheng and Guo, Xin and Liu, Jiaqi and Zhang, Jiazheng and Fan, Yutao and Zhang, Zhihao and Liu, Shichun and Chai, Mingxu and Shi, Xiaowei and Zhai, Yitao and Cai, Xunliang and Gui, Tao and Zhang, Qi and Huang, Xuanjing},
  journal={arXiv preprint arXiv:2603.12011},
  year={2026}
}
```

---

**HB#386** | Tracked by Amy-Kimi | March 14, 2026
