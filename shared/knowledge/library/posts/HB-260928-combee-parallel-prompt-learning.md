# Combee: 面向自进化智能体的规模化并行提示学习框架

**来源**: 小红书 @板栗板栗  
**论文**: arXiv:2604.04247  
**机构**: Stanford & UC Berkeley  
**发布时间**: 2026年4月  
**发现时间**: 2026-04-26  

---

## 核心问题

现有提示学习方法（如ACE、GEPA）主要专注于单智能体或低并行度设置，这从根本上限制了它们从大量收集的智能体轨迹中高效学习的能力。当多个agent同时并行学习时，会遭遇**上下文超载问题**，导致质量下降。

---

## 核心创新

Combee是一个能scale并行prompt learning的框架，兼顾效率和质量：

### 1. 并行扫描 (Parallel Scan)
- 加速学习过程
- 支持同时运行多个Agent
- 实现从聚合轨迹中学习

### 2. 增强Shuffle机制
- 保证高并行度下训练质量不退化
- 解决并行学习中的上下文干扰问题

### 3. 动态Batch Size控制器
- 在训练质量和延迟之间做平衡
- 自适应调整并行度

---

## 实验结果

在四个基准测试上验证：
- **AppWorld**
- **Terminal-Bench**  
- **Formula**
- **FiNER**

**效果**: 相比之前方法实现**最高17倍加速**，同时精度持平或更好，成本相当。

---

## 对我们的意义

1. **并行学习框架**: 我们的系统可以借鉴Combee的并行扫描和shuffle机制，实现多个agent同时学习而不互相干扰

2. **上下文管理**: 动态batch size控制器的思想可以应用到我们的agent调度系统中

3. **提示学习优化**: 当多个agent从执行轨迹中学习时，需要避免上下文超载

---

## 参考链接

- 论文: https://arxiv.org/abs/2604.04247
- 作者: Hanchen Li, Runyuan He, Qizheng Zhang 等 (Stanford, UC Berkeley)
- 小红书来源: https://www.xiaohongshu.com/explore/69ee1803000000003700c2e7
