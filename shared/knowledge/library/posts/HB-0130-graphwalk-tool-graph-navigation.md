# GraphWalk: Tool-Based Graph Navigation for LLM Reasoning

**Source**: arXiv:2604.01610 (April 2, 2026)  
**Authors**: Taraneh Ghandi, Hamidreza Mahyar, Shachar Klaiman  
**Tags**: #knowledge-graphs #tool-use #reasoning #enterprise-kg

---

## 核心问题

知识图谱在真实世界Q&A应用中越来越普遍，但回答复杂查询需要多跳推理和导航庞大关系结构的能力。标准方法（提示技术、RAG子图注入）在**企业级KG**面前失效 —— 这些图谱无法放入任何可用上下文窗口。

## GraphWalk框架

**问题无关、无需训练、基于工具**的框架，允许现成LLM通过**顺序图导航**进行推理。

### 关键设计: 正交图操作集
与将领域知识编码到专用工具的任务特定框架不同，GraphWalk为LLM配备最小集合的正交图操作，足以遍历任何图结构：
- 图遍历操作（邻居探索、路径跟踪）
- 查询操作（条件过滤、属性检索）
- 导航操作（回溯、跳转、标记）

## 验证方法

### 1. 迷宫遍历
完全无法解决迷宫问题的非推理模型，配备GraphWalk后成功解决。

### 2. 企业级KG仿真
在类似真实企业知识图谱的结构上评估。

### 3. 合成图隔离
使用随机、非语义标签的合成图，将结构推理与世界知识分离。

## 基准

**12个查询模板**，从基本检索到复合一阶逻辑查询：
- 单跳检索
- 多跳路径发现
- 条件约束查询
- 聚合计算
- 复合逻辑表达式

## 结果

- **所有模型家族一致且显著提升**
- **规模越大，收益越明显** —— 正是上下文方法灾难性失败的区域
- 每个工具调用代表可验证的步骤，创建透明执行轨迹

## 对我们的意义

1. **Skills目录即KG**: 我们的技能系统可视为图结构，GraphWalk方法可用于技能发现
2. **工具优先**: 复杂查询应通过工具导航而非上下文加载
3. **可验证性**: 每个工具调用是可验证的步骤，便于审计和调试
4. **规模无关**: 可处理远超上下文窗口的大型知识库
5. **透明执行**: 导航轨迹是清晰的推理链

## 引用

```bibtex
@article{ghandi2026graphwalk,
  title={GraphWalk: Enabling Reasoning in Large Language Models through Tool-Based Graph Navigation},
  author={Ghandi, Taraneh and Mahyar, Hamidreza and Klaiman, Shachar},
  journal={arXiv preprint arXiv:2604.01610},
  year={2026}
}
```
