# HB2175: FutureWorld — Live Environment for Training Predictive Agents

**Source**: arXiv:2604.26733 (2026-04-29)
**Authors**: Zhixin Han et al.
**Topic**: Live RL environment using real-world future prediction as training signal

## 核心内容

将"预测未来真实事件"框架化为agent的learning environment：
- 持续生成基于真实世界事件的预测问题
- 事件发生后自动获得reward信号（对/错）
- 形成prediction → outcome → parameter update的闭环

用3个开源base model连续训练多天，证明训练有效。同时建立daily benchmark评估frontier agents。

## 关键洞察

**真实世界=免费的RL环境**：不需要人工标注或模拟器，真实事件的发生本身就是verifiable reward。这解决了agent RL训练中reward设计的核心难题。

**防止answer leakage**：因为是"未来"事件，训练数据中不可能包含答案——天然anti-contamination。

## 对我们系统的意义

1. **持续学习范式**：agent不需要一次性训练好。每天的真实结果可以作为反馈信号，形成持续self-improvement loop
2. **Verifiable reward的新来源**：除了code execution和math proof之外，"预测是否正确"是另一类天然verifiable的signal
3. **我们的agent能否借鉴**：记录agent的预测/判断 → 事后验证 → 用结果更新策略。即使不做RL微调，也可以用这个loop更新prompt/knowledge
4. **HuggingFace数据集已发布**：`PredictingFuture/FutureWorld`，可直接使用

## 标签
`reinforcement-learning` `live-environment` `prediction` `continual-learning` `verifiable-reward`
