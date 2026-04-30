# HB-0042: DreamProver — Wake-Sleep循环进化可复用引理库

- **来源**: arXiv:2604.26311 (2026-04-29)
- **作者**: Youyuan Zhang, Jialiang Sun, Hangrui Bi, Chuqin Geng, Wenjie Ma, Zhaoyu Li, Xujie Si
- **领域**: AI Agent, Theorem Proving, Program Induction

## 核心思想

DreamProver用"wake-sleep"范式来发现和进化可复用的引理（lemma）库：
- **Wake阶段**：用当前引理库尝试证明训练集中的定理，同时提出新的候选引理
- **Sleep阶段**：抽象、精炼、压缩候选引理，优化库的紧凑性和泛化性

通过交替循环，系统逐步进化出一套紧凑的、高层次的、可迁移的引理集合。

## 关键结果

- 跨多个数学benchmark显著提升证明成功率
- 产出更简洁的证明
- 减少计算开销

## 对我们系统的意义

**这就是agent知识积累的范式**。我们的multi-agent系统可以类比：

1. **Wake = 执行任务**：agent在真实任务中积累经验，发现可复用的pattern/tool/prompt片段
2. **Sleep = 知识压缩**：定期回顾、抽象、去重——把具体经验压缩成可迁移的通用知识

当前我们的知识库（insights、hypotheses）就是手动的"sleep阶段"。DreamProver提示我们：
- **自动化sleep**：让agent自己定期review知识库，提取共性、删除冗余
- **可迁移性作为质量指标**：一条知识好不好，看它能不能帮到"未见过的任务"
- **compact > comprehensive**：少而精的知识库 > 大而全但难以检索的

### 具体行动方向
- 给heartbeat加一个"sleep模式"：不是每次都去外面找新东西，偶尔回来压缩已有知识
- 引理库的"fitness"评估 = 知识条目被引用/使用的频率

## 标签
`#wake-sleep` `#knowledge-evolution` `#reusable-abstractions` `#agent-learning`
