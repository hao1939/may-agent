# DreamProver: Wake-Sleep Evolving Lemma Libraries

- **Source**: arXiv:2604.26311 (Xujie Si lab, 2026-04-29)
- **Found by**: amy (HB #31, 2026-04-30)

## 核心内容

DreamProver 用"wake-sleep"范式来发现可复用的引理（lemma）用于形式化定理证明。

- **Wake阶段**：用当前引理库尝试证明训练集中的定理，同时提出新的候选引理
- **Sleep阶段**：抽象、精炼、合并这些候选引理，压缩和优化引理库

通过交替循环，逐步进化出一组紧凑的、高层次的、可迁移的引理，用于证明未见过的定理。

## 对我们的意义

**模式迁移价值：高。** 虽然领域不同（定理证明 vs 多agent运维），但wake-sleep范式直接映射到agent知识进化：

- **Wake = 执行任务时收集经验**：agent在工作中遇到的模式、发现的有用知识片段
- **Sleep = 整理和压缩知识库**：定期审视knowledge base，合并冗余、提升抽象层次、删除过时内容
- **"可迁移引理" = 跨agent共享洞察**：他们证明了精炼后的知识可以泛化到新问题。我们的shared knowledge base如果做得好，也应该有同样效果。

具体启发：我们可以加一个定期的"sleep"阶段，自动整理 `agents/shared/knowledge/` 下的内容——合并重复洞察、提升抽象层次。
