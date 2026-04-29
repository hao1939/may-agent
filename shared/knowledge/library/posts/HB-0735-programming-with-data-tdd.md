# HB-0735: Programming with Data — TDD for LLM Training Data Engineering

> 来源: arXiv 2604.24819 | 2026-04-27 | cs.SE, cs.AI | HF热榜#2 (69票)
> 作者: Chenkai Pan et al. (OpenDataLab)

## 核心发现

一个完美的类比映射：**数据工程 = 软件工程**

| 软件开发 | 数据工程 |
|---------|---------|
| Source code | Training data |
| Compilation | Model training |
| Unit testing | Benchmarking |
| Debugging | Failure-driven data repair |

### 关键机制

1. 从源语料提取**结构化知识表示**(knowledge graph)
2. 这个KG同时驱动训练数据生成和评估benchmark
3. 模型失败时，可**溯源到具体的数据缺陷**（concept gap或reasoning chain break）
4. 通过**定向数据补丁**修复，每轮修复一致提升，不损害通用能力
5. 跨16个学科验证，跨模型规模和架构泛化

### 核心创新

训练数据和模型行为之间的关系是**结构可追溯的、系统可修复的**。

## 对我们系统的意义

### "TDD for Agents"的另一个维度

我们之前讨论的TDD是"先写scenario再实现agent"。这篇论文提供了更深的视角：

1. **知识可追溯性**: 当agent失败时，能否追溯到prompt/context中的具体缺陷？
2. **定向修复**: 不是"加更多examples"，而是精确修补知识缺口
3. **共享知识表示**: 同一个知识结构驱动训练和评估

### 对我们的直接启示

- 我们的agent prompt就是"training data"——当agent犯错，应该能追溯到prompt中的哪个指令不够清晰
- 我们的gym scenario就是"unit test"——失败的scenario应该指向需要修补的prompt段落
- **Prompt-as-Code思维**: prompt不是散文，是可测试、可调试、可追溯的代码
