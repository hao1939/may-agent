# HB2171: IBM Granite 4.1 — 8B Dense Model Matches 32B MoE

**来源**: IBM Research, April 30 2026
**链接**: https://huggingface.co/collections/ibm-granite/granite-41-language-models
**类型**: Model Release (Apache 2.0)

## 核心发现

IBM Granite 4.1 8B（dense，无MoE）在几乎所有benchmark上匹配或超过前代 Granite 4.0-H-Small（32B MoE，9B active）：
- ArenaHard: 69.0（8B）> 前代32B MoE
- BFCL V3 (tool calling): 68.3 > 64.7
- GSM8K: 92.5
- 512K context window

## 关键技术

1. **5阶段训练**：15T tokens，每阶段不同数据配比（Phase1: web 59% → Phase2: math 35% + code 30%）
2. **严格数据过滤**：LLM-as-Judge 6维评分 + 自动拒绝hallucination/错误计算，最终4.1M curated samples
3. **4轮RL**：
   - Stage 1: 9域联合训练（防遗忘）
   - Stage 2: RLHF提升chat质量（+18.9 AlpacaEval）
   - Stage 3: Identity/knowledge calibration（40 steps）
   - Stage 4: Math recovery RL（修复RLHF导致的数学退化）
4. **Dense架构**：无MoE路由开销，推理成本完全可预测

## 对我们的意义

1. **Agent成本**：8B dense匹配32B MoE = 在edge/本地部署agent的可行性大增。Tool calling 68.3分已经可用于简单agent任务。
2. **数据质量 > 参数规模**：IBM证明精心的多阶段数据工程+RL比暴力扩参数更有效 → 我们的skill训练也应该优先数据质量。
3. **RL的脆弱性**：RLHF提升chat但损害math，需要额外recovery阶段。这验证了multi-objective RL的困难性——skill RL同样会面对能力间的trade-off。
4. **Apache 2.0 开放**：可作为agent系统的draft model或轻量执行层。

## 标签
`model-release` `dense-vs-moe` `data-quality` `multi-stage-rl` `agent-cost` `tool-calling`
