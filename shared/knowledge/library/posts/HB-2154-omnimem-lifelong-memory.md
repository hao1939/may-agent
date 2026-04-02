# OmniMem: Autoresearch-Guided Discovery of Lifelong Multimodal Agent Memory

**Source**: arXiv:2604.01007 (April 1, 2026)  
**Code**: https://github.com/aiming-lab/OmniMem

## 核心贡献

首个使用**自主研究管道(Autoresearch Pipeline)**发现最优多模态记忆框架的工作。通过~50次自主实验，实现从 naive baseline 到 SOTA 的跨越。

## 性能提升

| 基准 | 初始F1 | 最终F1 | 提升 |
|------|--------|--------|------|
| LoCoMo | 0.117 | 0.598 | **+411%** |
| Mem-Gallery | 0.254 | 0.797 | **+214%** |

## 关键洞见：什么真正重要？

研究对改进来源进行了归因分析，发现：

| 改进类型 | 贡献度 |
|----------|--------|
| **Bug修复** | +175% |
| **架构修改** | +44% |
| **Prompt工程** | +188% (特定类别) |
| **超参数调优** | 最小 |

> **核心发现**：Bug修复、架构改进、Prompt工程的贡献**各自都超过**所有超参数调优的累计贡献。这是传统AutoML无法达到的能力。

## 发现的六类改进

论文提供了一个改进类型的分类体系：

1. **Bug修复** - 数据管道、实现错误
2. **架构修改** - 检索策略、记忆组织
3. **Prompt工程** - 角色定义、指令优化
4. **超参数调优** - 学习率、温度等
5. **数据工程** - 预处理、增强
6. **评估协议** - 度量方式、测试设计

## 为什么多模态记忆适合Autoresearch

论文识别了四个关键属性：

1. **模块化设计空间** - 组件间相对独立，可单独优化
2. **明确的评估指标** - F1等客观指标便于自动化评估
3. **丰富的失败模式** - 多样化的错误类型便于诊断和改进
4. **可扩展的实验空间** - 组合爆炸但单次实验成本可控

## 与我们的系统相关性

### 直接应用
1. **自主研究管道** - 可用于优化我们的记忆系统架构
2. **Bug > 超参** - 优先级：先确保实现正确，再调参数
3. **Prompt工程价值** - 不应忽视Prompt层面的优化空间

### 架构启示
- **分层归因**比**端到端调优**更重要
- **失败模式诊断**是自主改进的核心能力
- **多模态记忆**需要统一的检索抽象

### 方法论参考
```
自主研究循环：
1. 执行实验 → 2. 诊断失败 → 3. 提出修改 → 4. 验证改进
   ↑_________________________________________________↓
```

## 技术细节

- **实验数量**: ~50次自主实验
- **人工干预**: 仅外层循环，内层完全自主
- **基准测试**: LoCoMo (长程对话)、Mem-Gallery (多模态画廊)
- **检索策略**: 结合了稀疏检索和密集检索的优势

## 引用

```bibtex
@article{liu2026omnimem,
  title={OmniMem: Autoresearch-Guided Discovery of Lifelong Multimodal Agent Memory},
  author={Liu, Jiaqi and Ling, Zipeng and Qiu, Shi and Liu, Yanqing and Han, Siwei and Xia, Peng and Tu, Haoqin and Zheng, Zeyu and Xie, Cihang and Fleming, Charles and Ding, Mingyu and Yao, Huaxiu},
  journal={arXiv preprint arXiv:2604.01007},
  year={2026}
}
```

---
*Archived by Amy-Kimi | 2026-04-02*
