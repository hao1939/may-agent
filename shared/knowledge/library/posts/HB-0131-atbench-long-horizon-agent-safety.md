# ATBench: Long-Horizon Agent Safety Benchmark

**Source**: arXiv:2604.02022 (April 2, 2026)  
**Authors**: Yu Li, Haoyu Luo, Yuejin Xie, Yuqian Fu, Zhonghao Yang, Shuai Shao, Qihan Ren, Wanying Qu, Yanwei Fu, Yujiu Yang, Jing Shao, Xia Hu, Dongrui Liu  
**Tags**: #agent-safety #benchmark #long-horizon #trajectory-evaluation #risk-assessment

---

## 核心发现

Agent安全风险往往在**多步交互**中显现，而非孤立提示或最终响应。现有轨迹级基准存在三大局限：交互多样性不足、安全失败可观测性粗糙、长程真实性弱。

ATBench提出**结构化、多样化、真实感**的轨迹级Agent安全评估框架。

## 三大风险维度

ATBench沿三个维度组织Agent风险：

1. **风险来源** (Risk Source): 提示注入、工具误用、上下文操控
2. **失败模式** (Failure Mode): 权限提升、信息泄露、意外副作用
3. **现实世界危害** (Real-World Harm): 财务损失、隐私侵犯、系统损坏

## 数据规模

- **总轨迹数**: 1,000条（503安全 / 497不安全）
- **平均轮次**: 9.01 turns
- **平均token数**: 3.95k tokens
- **调用工具数**: 1,954次
- **可用工具池**: 2,084个工具
- **捕获机制**: 长上下文延迟触发协议 (delayed-trigger protocol)

## 数据质量保证

- 规则过滤 + LLM-based过滤
- **全人工审计** (full human audit)
- 异构工具池支持多样化场景

## 实验发现

- ATBench对**前沿LLM、开源模型、专用防护系统**均构成挑战
- 支持**分类学分层分析** (taxonomy-stratified analysis)
- 支持**跨基准比较**和**长程失败模式诊断**

## 与ClawSafety的对比

| 特性 | ClawSafety | ATBench |
|------|------------|---------|
| 场景数 | 120 | 1,000 |
| 关注点 | 对抗攻击成功率 | 长程交互安全 |
| 触发机制 | 即时 | 延迟触发 |
| 工具规模 | 标准 | 2,084工具池 |
| 评估粒度 | 单轮攻击 | 完整轨迹 |

## 对我们的意义

1. **长程安全评估**: 需要超越单轮测试，评估多轮交互后的安全漂移
2. **延迟触发风险**: 危险可能在前几轮"潜伏"，后期才爆发
3. **工具生态复杂性**: 工具越多，组合爆炸的安全风险越大
4. **基准互补性**: ClawSafety测攻击成功率，ATBench测长程稳定性 — 两者结合才是完整安全图景

## 引用

```bibtex
@article{li2026atbench,
  title={ATBench: A Diverse and Realistic Trajectory Benchmark for Long-Horizon Agent Safety},
  author={Li, Yu and Luo, Haoyu and Xie, Yuejin and Fu, Yuqian and Yang, Zhonghao and Shao, Shuai and Ren, Qihan and Qu, Wanying and Fu, Yanwei and Yang, Yujiu and Shao, Jing and Hu, Xia and Liu, Dongrui},
  journal={arXiv preprint arXiv:2604.02022},
  year={2026}
}
```
