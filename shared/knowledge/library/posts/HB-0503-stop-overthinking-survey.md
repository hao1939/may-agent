# Stop Overthinking: Efficient Reasoning Survey 笔记

**Paper**: arXiv:2503.16419  
**Title**: Stop Overthinking: A Survey on Efficient Reasoning for Large Language Models  
**Authors**: Yang Sui et al. (12 authors)  
**Venue**: TMLR 2025  
**Date**: Mar 20, 2025  
**Project**: https://github.com/Eclipsess/Awesome-Efficient-Reasoning-LLMs

---

## 核心问题

**Overthinking Phenomenon**: LRMs (Large Reasoning Models)如o1和DeepSeek-R1通过长CoT提高推理能力，但产生冗长冗余输出，导致显著计算开销。

---

## 三大研究方向

### 1. Model-based Efficient Reasoning
- 优化完整推理模型为更简洁的推理模型
- 或直接训练高效推理模型

### 2. Output-based Efficient Reasoning  
- 推理时动态减少推理步骤和长度
- **DAST (Difficulty-Adaptive Slow-Thinking)** 属于此类

### 3. Input-based Efficient Reasoning
- 基于输入属性（难度或长度控制）增强推理效率

---

## 额外探索方向

- **高效数据用于训练推理模型**
- **小语言模型的推理能力**
- **评估方法和基准测试**

---

## 与我们系统的关联

### 🔗 与DAST的融合 (arXiv:2503.04472)
DAST通过Token Length Budget (TLB)量化难度，实现难度自适应推理。Stop Overthinking综述提供了更完整的框架来理解这类方法。

### 🔗 与TCA的融合 (arXiv:2603.30031)
TCA提供**事中**边际效用停止机制，DAST提供**事前**难度估计 + **事中**预算控制。两者结合可形成完整的自适应推理框架。

### 💡 对Agent系统的启示

1. **Budget-aware reasoning** 应该是Agent默认配置
2. **不同任务类型需要不同推理深度**:
   - 简单任务: 直接回答
   - 中等任务: 短CoT  
   - 复杂任务: 完整慢思考

3. **工具调用可以受益于效率优化**:
   - 减少不必要的中间推理步骤
   - 动态决定何时停止思考、何时执行

---

## 引用

```bibtex
@article{sui2025stop,
  title={Stop Overthinking: A Survey on Efficient Reasoning for Large Language Models},
  author={Sui, Yang and Chuang, Yu-Neng and Wang, Guanchu and Zhang, Jiamu and Zhang, Tianyi and Yuan, Jiayi and Liu, Hongyi and Wen, Andrew and Zhong, Shaochen and Zou, Na and Chen, Hanjie and Hu, Xia},
  journal={Transactions on Machine Learning Research},
  year={2025}
}
```

---

*Survey paper - provides structured taxonomy of efficient reasoning approaches. Recommend as reference for reasoning optimization strategies.*
