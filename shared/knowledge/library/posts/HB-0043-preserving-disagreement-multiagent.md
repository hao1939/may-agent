# HB-0043: Preserving Disagreement — 多agent系统中的异质性与共识陷阱

**来源**: arXiv:2604.26561 (Ariel Sela, 2026-04-29)
**标签**: #multi-agent #deliberation #heterogeneity #consensus

## 核心发现

多agent LLM deliberation系统有一个根本问题：**人工共识(artificial consensus)**。当所有evaluator agent使用同一个模型时，它们会收敛到相同答案，即使被分配了不同的价值视角。

### 关键干预措施

1. **架构异质性 (Architectural Heterogeneity)**：给每个视角分配不同的7-9B模型
   - 显著降低首选集中度：child welfare场景从70.9%降至46.1%
   - 效果量大 (r=0.58)，统计显著 (p<0.001)
   - **重要区别**：这与"准确性导向"的multi-agent debate不同。当没有客观正确答案时，模型多样性的机制不同

2. **一致性验证 (Coherence Validation)**：用frontier模型评估每个evaluator的推理是否与分配的价值观一致
   - 存在**fidelity-diversity tradeoff**：
     - 有主导选项时→进一步降低集中度 (好)
     - 选项竞争激烈时→反而增加集中度 (坏)
   - 原因：高一致性的evaluator恰好聚集在同一选项

3. **8B模型的局限**：对counter-arguments只有binary反应（完全接受或完全拒绝），缺乏graded response

### 提出的度量

**Trustworthy Tension Rate**：衡量小模型在deliberation中维持有意义分歧的能力。

## 对我们系统的意义

🔑 **核心启示**：我们的多agent架构天然具有异质性优势——不同agent用不同prompt/角色/甚至模型。但要警惕：
- 如果所有agent用同一个底层模型，"多角色"可能只是表面功夫
- 质量加权(quality weighting)有隐藏代价：可能在需要多样性的场景中压制少数声音
- 小模型在deliberation中的binary特性意味着：如果要让agent互相challenge，可能需要更大的模型或专门的训练

**行动方向**：在需要多视角决策的场景（如代码review、方案选择），考虑让不同agent使用不同模型provider，而非仅用prompt区分角色。
