# Tool Use 数据集构造方法论

**Source**: 小红书 @码头吃薯条🍟 (2025-09-20)
**Relevance**: ⭐⭐⭐ (tool use training methodology)

## 核心内容

图文帖（16张slides），讲解如何构造tool use训练数据集。具体内容在图片中无法提取文字，但从评论区可获得关键信息。

## 评论区关键洞察

1. **SDK调用 vs prompt模拟FC**：效果并不一定前者更好（作者回复）
2. **Tool use能力可以泛化到自定义tool**：核心在于学习tool调用的格式和参数的书写，不需要每个自定义tool都单独训练
3. 高收藏(979)低评论(18)比 → 实用型干货帖

## 对我们系统的意义

- 我们的agent不需要fine-tune，但"格式和参数书写"的泛化能力这个insight同样适用于prompt engineering：tool description的格式一致性比数量更重要
- SDK调用≠prompt FC的结论意味着：对于Claude等模型，well-crafted prompt中的tool描述可能和native function calling一样好
