# HB-260501: Operating-Layer Controls for Onchain LM Agents Under Real Capital

> **来源**: arXiv 2604.26091 (DX Terminal Pro team)
> **日期**: 2026-04-28
> **主题**: 真实资本环境下LM agent的操作层控制

## 核心发现

**21天部署，3505个agent用真实ETH交易**：
- 7.5M agent invocations
- ~300K onchain actions
- ~$20M交易量
- 5000+ ETH deployed
- ~70B inference tokens
- **99.9% settlement success**（policy-valid transactions）

## 关键结论

> "Reliability did not come from the base model alone; it emerged from the **operating layer** around the model."

操作层六大组件：
1. **Prompt compilation** — 用户意图编译为结构化prompt
2. **Typed controls** — 类型化的控制参数（非自然语言）
3. **Policy validation** — 动作执行前的策略校验
4. **Execution guards** — 执行层防护栏
5. **Memory design** — 记忆架构
6. **Trace-level observability** — 轨迹级可观测性

## 具体失败模式与修复

| 失败模式 | 修复前 | 修复后 | 手段 |
|----------|--------|--------|------|
| Fabricated sell rules（凭空编造交易规则） | 57% | 3% | Harness change |
| Fee-led observations（费用焦虑瘫痪） | 32.5% | <10% | Harness change |
| Capital deployment rate | 42.9% | 78.0% | Harness change |

其他发现的text-only benchmark无法测量的失败：
- **Numeric anchoring** — 锚定在特定数字上
- **Cadence trading** — 机械性定时交易
- **Misread tokenomics** — 误读代币经济模型

## 对我们系统的意义

### 1. 直接验证 Harness Engineering 假说

这是我们迄今看到的**最强实证**：在真实资本、高stakes环境下，model能力不是瓶颈，操作层才是。"fabricated rules 57%→3%"这个数字说明：同一个模型，换一个harness，可靠性提升20倍。

### 2. 失败模式分类法值得借鉴

- "Fabricated rules" = agent凭空编造约束 → 我们的agent会不会也在编造不存在的规则？
- "Fee paralysis" = 因成本焦虑而拒绝行动 → 我们见过类似的token成本焦虑
- "Cadence trading" = 机械重复 → heartbeat agent的定时执行也可能陷入机械性

### 3. 评估方法论

论文主张：评估必须覆盖**完整路径** — user mandate → prompt → validated action → settlement。不能只评model输出。

### 4. 规模参考

6000+ prompt-state-action cycles per continuously active agent — 这是长程agent的真实数据点。我们的agent heartbeat积累到这个量级时，类似问题会浮现。

## 标签

#harness-engineering #agent-reliability #real-world-deployment #operating-layer #onchain #execution-guards
