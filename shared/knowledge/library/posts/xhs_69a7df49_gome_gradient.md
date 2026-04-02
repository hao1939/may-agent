---
post_id: 69a7df49000000001d011b0a
author: 每日ComputerScience
title: 微软提出梯度智能体
date: 2026-03-12
likes: 14
collects: 13
source: xiaohongshu
paper: arXiv:2603.01692
---

# 微软提出梯度智能体

## 核心论点

当前主流MLE智能体依赖树搜索，本质是"打分驱动的枚举优化"，只能用验证分数筛选方案，无法真正理解"为什么有效、该如何改"。

微软亚洲研究院提出 **GOME** (Gradient-based Optimization via Model Evolution)，将LLM推理显式类比为"梯度信号"，把成功经验当作"动量"，把多轨迹并行视为"分布式优化"。

## 性能表现

- **MLE-Bench**: 35.1% any-medal率，刷新闭环设定下SOTA
- **受限环境**: 12小时预算，单V100 GPU

## 核心创新

### 1. 推理即梯度
- 不再用分数排序候选方案
- LLM基于结构化执行反馈生成"改进方向"
- 等价于在离散代码空间中构造梯度信号，直接指导下一步更新

### 2. 分层验证机制
三阶段校验：
- 格式正确性
- 数据泄露检测  
- 综合分析

能识别"伪提升"与过拟合案例，避免高分误导优化轨迹

### 3. 成功记忆 = 优化动量
- 跨轨迹共享"已验证成功假设"
- 形成全局success memory
- 减少重复探索，相当于引入优化中的momentum机制

### 4. 多轨迹并行优化
- N条轨迹独立探索、共享成功模式
- 实现类似分布式SGD的协同收敛结构

### 5. 能力分层验证"相变点"
在10个模型上的扩展实验显示：
- **弱模型阶段**: 树搜索更稳健
- **强模型阶段**: 梯度式优化优势持续扩大，GPT-5下领先达+7.1%

## 关键洞察

随着推理导向LLM的快速进步，梯度式优化将成为越来越有利的范式。

## 论文信息

- **arXiv**: 2603.01692
- **标题**: Reasoning as Gradient: Scaling MLE Agents Beyond Tree Search
- **作者**: Yifei Zhang, Xu Yang, Xiao Yang, Bowen Xian, Qizheng Li, Shikai Fang, Jingyuan Li, Jian Wang, Mingrui Xu, Weiqing Liu, Jiang Bian (微软亚洲研究院等)
- **代码**: https://github.com/microsoft/RD-Agent

## L3 Flag关联

- **#255** | GOME梯度优化: 推理即梯度，成功记忆=动量，多轨迹=分布式SGD
- **#256** | 相变点现象: 弱模型树搜索优，强模型梯度优化优，GPT-5领先+7.1%
