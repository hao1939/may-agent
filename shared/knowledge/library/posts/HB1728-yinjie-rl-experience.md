# HB#1728: 做了一年RL的小经验

**Source**: XHS@Yinjie  
**Date**: 2026-03-08  
**Engagement**: 1349赞 / 2115收藏 / 148评论  
**Status**: 🔥🔥🔥🔥🔥 里程碑级技术洞察

---

## 作者背景
Yinjie，从一年前转AI开始做RL，做过的setting包括OpenClaw-RL、RLAnything、dLLM-RL、CURE等，"天天大规模跑实验"。

## 核心洞察

### 1. KL Loss选择：k1 vs k3
- **问题**：用slime训computer use agents时总训一半就崩
- **元凶**：用的是k1 KL loss而不是k3
- **k1缺陷**：会持续惩罚本来就小的log p，在难任务上log p本来就要被reward惩罚，再被k1一惩罚，模型立刻坍塌
- **k3优势**：保证KL loss为严格正，完美解决这个问题

### 2. Value Model的重要性
- "很多人不知道value model的重要性，赋予token level advantage能很好稳定训练"
- ICLR reviewer认为value model是多余的——"典型的实验不跑，天天看各种g*po的后遗症"
- **业界实况**：大多用的还是PPO

### 3. 常见参数设置
| 参数 | 推荐值 | 说明 |
|------|--------|------|
| updates per step | 1 | 保证尽量on-policy |
| task per step * sample per task | 越多越好 | rollout越多越稳定 |
| RL loss lr | 1e-6 | 新手常错调成1e-5，通常很寄 |
| task难度 | 合理设置 | 影响收敛 |
| clip ratio/kl coefficient/temperature | 合理设置 | 基础调参 |

### 4. Agentic RL额外问题
- **Advantage估计**：每个step的advantage要怎么估计，不做好standardization会直接影响效果
- **Env复杂性**：真实复杂env本身的不稳定性会影响样本质量
- **数据清洗**：收集训练数据前要去掉未完成或被低质量env feedback污染的样本
- **异步训练**：为防止长尾问题用异步，这种"off-policy"从实验看没什么影响

---

## 评论精华

**Q: agentic rl需要多少算力？**  
A: 八张卡就够了

**Q: 用rl提升tool call能力算agent rl吗？**  
A: 是agentic rl，它特点就是要一个个串行（不能batch并行）

**Q: 做agentic rl推荐的codebase？**  
A: 算力不够做tool call或alfworld，资源多直接上general agent（terminal/gui/swe）。**过两天会在OpenClaw-RL上开源各种general agent setting下的大规模rl训练代码**。

**Q: 每个step都计算reward还是只对最终结果？**  
A: 目前框架（verl, areal）都是最后给outcome，对交互轮数多的setting不够看

**Q: 内存泄漏问题？**  
A: Slime确实有这个问题，可以用OpenClaw-RL优化过的slime

---

## 与OpenClaw的关联

### 🔥 直接关联
1. **OpenClaw-RL**是作者主要工作之一
2. **即将开源general agent RL训练代码** —— 与OpenClaw Skill系统潜在结合点
3. **Computer Use Agents** —— 与OpenClaw的Computer Use Skill直接相关

### 💡 架构启示
- **异步RL设计**：后台训练与前端调用解耦，与OpenClaw的Error Log设计哲学一致
- **Value Model重要性**：Skill评估可能需要引入value-based机制
- **数据清洗**：ERL中的Error Log可以作为"低质量feedback"的过滤信号

---

## Action Items

1. **关注OpenClaw-RL开源动态** —— general agent RL训练代码即将发布
2. **评估Skill系统RL化可能性** —— 能否用AReaL/OpenClaw-RL框架训练Skill
3. **重新审视KL Loss设置** —— 如有RL训练需求，优先k3而非k1
4. **Value Model调研** —— Skill评估是否需要token-level advantage机制

---

## L3 Flags

- **#1728-1**: 监控OpenClaw-RL开源的general agent RL代码，评估与Skill系统的结合点
- **#1728-2**: 调研Value Model在Skill评估中的应用可能性
- **#1728-3**: 如未来做RL训练，确保使用k3 KL loss而非k1

---

**Last Updated**: 2026-03-16
