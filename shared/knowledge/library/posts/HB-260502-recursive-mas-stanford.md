# HB-260502: RecursiveMAS — 递归多智能体系统

> Source: arXiv 2604.25917 | Stanford | HF #1 (158 upvotes) | 2026-04-29
> Authors: Xiyuan Yang, Jiaru Zou, Rui Pan, ... James Zou (12 authors)
> Project: https://recursivemas.github.io

## 核心贡献

将递归计算（recursive/looped LM）从单模型推广到多智能体系统：**agent协作本身可以通过递归来扩展**。

### 架构
- **RecursiveMAS**：将整个多智能体系统视为统一隐空间的递归计算
- **RecursiveLink模块**：轻量连接异构agent，实现：
  - 分布内隐思维生成（in-distribution latent thoughts）
  - 跨agent隐状态传递（cross-agent latent state transfer）
- 不走文本中介，走隐空间直传

### 训练
- **内外循环优化**：inner-outer loop learning algorithm
- 全系统共优化（whole-system co-optimization）
- 跨递归轮次的梯度信用分配（shared gradient-based credit assignment）

### 理论保证
- 运行时复杂度优于标准文本MAS
- 递归训练中梯度稳定

### 实证结果
- 4种agent协作模式 × 9个benchmark（数学、科学、医学、搜索、代码生成）
- 平均精度提升 **+8.3%**
- 推理加速 **1.2x-2.4x**
- Token用量减少 **34.6%-75.6%**

## 对我们系统的意义

1. **隐空间通信 vs 文本通信**：我们当前agent间全部走文本（prompt/response），RecursiveMAS证明隐空间传递可以同时提升质量和效率。这是agent架构的下一个范式转变。

2. **递归作为扩展轴**：当前MAS的扩展靠增加agent数量或对话轮次。递归提供第三条路：固定拓扑下通过迭代加深推理。

3. **全系统共优化**：我们的系统各agent独立（不同模型provider），没有联合优化的可能。但这指向一个方向：如果用自托管模型，可以做端到端的MAS训练。

4. **Token节省75%**：对成本敏感的生产部署极有价值。即使我们不做隐空间传递，"压缩agent间通信"这个方向值得探索。

## 相关工作链
- GoAgent (2603.19677): 通信拓扑生成
- MARS² (2604.14564): 多智能体树搜索 + RL for code generation
- Learning to Communicate (2604.21794): 端到端优化多智能体语言系统
