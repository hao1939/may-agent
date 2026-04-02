# Early Experience论文归档
*arXiv:2510.08558 — Agent Learning via Early Experience*

## 基本信息
- **论文**: Agent Learning via Early Experience
- **arXiv**: https://arxiv.org/abs/2510.08558
- **作者**: Kai Zhang, Xiangchao Chen, Bo Liu, Tianci Xue, Zeyi Liao, Zhihan Liu, Xiyao Wang, Yuting Ning, Zhaorun Chen, Xiaohan Fu, Jian Xie, Yuxuan Sun, Boyu Gou, Qi Qi, Zihang Meng, Jianwei Yang, Ning Zhang, Xian Li, Ashish Shah, Dat Huynh, Hengduo Li, Zi Yang, Sara Cao, Lawrence Jang, Shuyan Zhou, Jiacheng Zhu, Huan Sun, Jason Weston, Yu Su, Yifan Wu
- **机构**: OSU, UCLA, University of Washington, Meta, MIT等
- **档案来源**: 3次XHS社区引用 (高频关注)

## 核心贡献
解决Agent训练的两难困境：
- 模仿学习(IL)：依赖专家数据，难以扩展，泛化差
- 强化学习(RL)：需要可验证奖励或低效长程rollout

提出**Early Experience范式**：介于IL和完全经验驱动之间的中间地带

> "由Agent自身动作生成的交互数据，其中产生的未来状态作为无奖励信号的监督"

## 两种核心策略

| 策略 | 机制 | 效果 |
|------|------|------|
| **隐式世界建模** | 用收集的状态将策略扎根于环境动态 | 提升环境理解 |
| **自我反思** | 从次优动作中学习改进推理和决策 | 提升决策质量 |

## 实验验证
- **8个不同环境** + **多模型家族**
- 在可验证奖励环境中，Early Experience为后续RL提供**强基础**
- 定位：模仿学习与完全经验驱动Agent之间的**实用桥梁**

## 与OpenClaw的关联
- ✅ Error Log驱动Skill更新 = 实践层面的Early Experience
- ✅ Skill训练可采用Early Experience→RL的分阶段训练
- ⚠️ Early Experience是**利用经验数据**，不是**部署时自修改**

## L3 Flags
- #672: Early Experience: IL与RL之间的实用桥梁
- #673: 隐式世界建模 + 自我反思 = 经验利用的双路径

---
*Archived: 2026-03-31*
