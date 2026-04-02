# RePanda: Pandas-powered Tabular Verification and Reasoning

**来源**: arXiv:2503.11921  
**发现日期**: 2026-04-02  
**标签**: `#agent-tool` `#tabular-data` `#verification` `#pandas`

---

## 核心贡献

RePanda是一种结构化事实验证方法，将声明转换为可执行的pandas查询，实现可解释且可验证的推理。

### 技术方案

**PanTabFact数据集**
- 基于TabFact训练集构建的结构化数据集
- 声明与可执行查询配对
- 使用DeepSeek-Chat生成，经自动纠错优化

**模型与性能**
- 基础模型: DeepSeek-coder-7B-instruct-v1.5
- TabFact测试集准确率: **84.09%**
- 零样本接近DeepSeek-Chat(671B)性能
- 将大模型的结构化推理蒸馏到7B本地可执行模型

### OOD泛化评估

**WikiFact数据集**
- 将WikiTableQuestions的问答对解释为事实声明
- 无需额外微调: **84.72%** 准确率
- 显著超越所有其他基线，展示强OOD鲁棒性

**表格问答扩展**
- PanWiki数据集: 映射WikiTableQuestions到pandas查询
- 直接答案检索准确率: **75.1%**

---

## 对我们的意义

### 1. 工具调用模式验证
RePanda验证了"结构化执行推理"在特定领域(表格)的有效性。这支持我们ToolUse层的设计——将自然语言意图转换为结构化操作。

### 2. 蒸馏可行性
从671B到7B的成功蒸馏表明：复杂推理能力可以通过高质量数据集+微调转移到更小模型。这对我们考虑本地/边缘部署有参考价值。

### 3. 可验证性设计
"可执行查询=可验证推理"的思路值得借鉴。在我们的skill系统中，可以考虑:
- 生成带追踪的操作序列
- 中间结果可检查、可回滚
- 断言(assertion)内建到工具调用

---

**数据集**: https://huggingface.co/datasets/AtoosaChegini/PanTabFact
