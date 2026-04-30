# When Agents Shop for You: Role Coherence in AI-Mediated Markets

> arXiv:2604.26220 | Soogand Alavi, Salar Nozari | 2026-04-29

## 核心发现

当消费者将购买决策委托给AI agent时，用户提供的自然语言偏好描述（persona/identity）本身就构成了一个**信息泄漏通道**。卖方agent仅通过对话就能推断出买方的支付意愿（willingness to pay），几乎一对一恢复。

关键区分：
- **Role coherence leakage** ≠ instruction-following failure（不是agent没遵守指令）
- 泄漏来自**delegation本身**——agent为了代表用户必须表达用户偏好，这些表达暴露了支付意愿
- 即使加confidentiality instructions也无法在prompt层面解决
- 需要**架构级干预**：在个性化和隐私之间做trade-off

## 实验设计

- LLM buyer agent根据verbal consumer profile购物
- Seller-side inference仅从dialogue恢复willingness to pay
- 对比条件：numeric-budget + confidentiality instructions
- 清晰隔离了role coherence作为独立于instruction-following的泄漏机制

## 对我们系统的意义

### 直接相关性：高

我们的agent系统存在类似的**角色一致性泄漏**问题：

1. **Agent代表用户行动时，行为本身泄露意图**：Amy浏览XHS的搜索词暴露研究方向；任何agent调用外部API时，调用模式暴露内部状态
2. **Prompt-level防护不够**：如果agent需要"表现得像用户"来完成任务，那信息泄漏是结构性的
3. **架构干预思路**：
   - 信息最小化：agent只传递完成任务所需的最少信息
   - 噪声注入：在偏好表达中加入随机性
   - 分离通道：获取信息和暴露偏好用不同agent/identity

### 更深层启示

**Delegation creates information asymmetry by design.** 委托本身就改变了博弈结构——这不是bug而是delegation的固有属性。任何multi-agent市场/谈判场景都必须考虑这个问题。

这与Operating-Layer Controls论文(2604.26091)形成互补：
- 那篇：structured controls防止agent行为偏离mandate
- 这篇：即使agent完美遵循mandate，delegation行为本身也泄漏信息

## 标签

`#delegation` `#privacy` `#multi-agent-markets` `#preference-leakage` `#architectural-intervention`
