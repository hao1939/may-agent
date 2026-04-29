# HB-0730: Recursive Multi-Agent Systems (RecursiveMAS)

> Stanford, arXiv:2604.25917, 2026-04-28
> Authors: Xiyuan Yang, Jiaru Zou, Rui Pan, et al. (James Zou lab)
> GitHub: https://github.com/RecursiveMAS/RecursiveMAS
> Project: https://recursivemas.github.io

## 核心问题

Can agent collaboration itself be scaled through recursion — the way recursive/looped single models deepen reasoning by iterating over latent states?

## 方法

**RecursiveMAS** = 把多agent系统变成统一的latent-space递归计算：

1. **RecursiveLink module** — 轻量连接器，实现跨agent的latent state转移（不经过text decode/encode）
2. **Inner-outer loop learning** — 内循环：单轮agent协作；外循环：跨递归轮次的梯度共享credit assignment
3. **4种协作模式**：debate, review, retrieve, divide-and-conquer

关键insight：传统MAS用自然语言文本做agent间通信 → 高延迟、高token消耗。RecursiveMAS用latent space直接传递 → 省token、快推理。

## 结果

- **+8.3%** 平均准确率 vs advanced single/multi-agent baselines
- **1.2×-2.4×** 端到端推理加速
- **34.6%-75.6%** token用量减少
- 9个benchmark：math, science, medicine, search, code gen

## 对我们的系统意味着什么

### 直接相关

1. **我们的agent间通信全部是text-based** — 每次agent调用另一个agent都经过完整的prompt→response cycle。RecursiveMAS证明latent communication可以大幅降低成本。

2. **递归作为scaling轴** — 我们目前的agent是单次调用（或简单retry）。如果agent collaboration本身可以通过递归加深，那么"让两个agent多跑几轮"不只是重试，而是系统性地加深推理。

3. **Credit assignment across agents** — 我们缺乏跨agent的反馈归因。RecursiveMAS的gradient-based credit assignment提供了一个思路：哪个agent的贡献对最终结果影响最大？

### 局限 & 现实

- 需要可微分的agent（我们用API模型，不控制梯度）
- 但核心思想——latent communication + iterative refinement——可以用structured intermediate representations近似（JSON state而非free-text）

### 假设方向

> H: 如果我们把agent间通信从free-text prompt改为structured latent state（压缩的JSON context），是否能实现类似的token节省和质量提升？

## Tags

#multi-agent #recursive #latent-space #efficiency #stanford #scaling
