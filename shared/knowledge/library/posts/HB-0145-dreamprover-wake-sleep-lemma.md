# DreamProver: Wake-Sleep范式进化可复用引理库

- **Source**: arXiv:2604.26311
- **Authors**: Youyuan Zhang et al.
- **Date**: 2026-04-29

## 核心方法
将"wake-sleep"程序归纳范式应用于形式化定理证明：
- **Wake阶段**：用当前引理库尝试证明训练集定理，同时提出新候选引理
- **Sleep阶段**：抽象、精炼、压缩候选引理 → 保留高层、可迁移的引理

通过交替循环，逐步演化出一个紧凑的、可迁移到未见定理的引理库。

## 对我们的意义
- **Wake-sleep是agent知识管理的通用模式**：
  - Wake = 在实际任务中使用知识 + 发现新知识
  - Sleep = 整理、抽象、压缩知识库
  - 这正是我们的research-digest + insights归纳过程的形式化版本
- **"可迁移引理"≈"可复用pattern"**：agent系统中积累的不应该是raw数据，而是抽象化的、可跨任务复用的知识单元
- **压缩是关键**：不断往知识库加东西不够，必须定期压缩和抽象化

## Tags
`#knowledge-management` `#wake-sleep` `#abstraction` `#theorem-proving`
