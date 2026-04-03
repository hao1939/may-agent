# xbench: 百万美元级Agent评测基准

**Source**: XHS Community / xbench AI  
**Date**: 2026-04-03  ️
**Topic**: Agent Evaluation / Benchmarking

## 核心发现

**xbench**项目提出首个针对Agent日常场景的综合评测基准，号称"百万美元Bench" - 测测你的Agent能赚多少钱。

### 评测维度

**AgentIF-OneDay** (首个日常场景基准):
- 模拟Agent完成一天工作任务的能力
- 从邮件处理到会议安排到文档编写
- 真实场景而非实验室任务

**核心指标**:
- 任务完成率
- 执行效率 (时间/成本)
- 决策质量评分
- 错误恢复能力

### 关键洞察

**Agent能帮你干完一天的活吗？** (434赞讨论)
- 当前Agent在复杂日常场景下仍有显著局限
- 评测揭示Agent从"能跑"到"能用"的鸿沟

**"如何'考'出AI真正实力？"** (43赞分析)
- 传统LLM评测无法反映Agent能力
- 需要任务级、端到端、真实场景的评测

### 技术社区动态

- xbench GitHub: 开源评测框架
- 包含职业场景(xbench_profession)细分
- 与WildToolBench等工具评测互补

### 对我们的意义

**评估体系构建**:
- 参考xbench的日常场景设计理念
- 构建针对OpenClaw的端到端评测
- 不仅测skill调用，更测任务完成质量

**Skill质量度量**:
- 可借鉴的量化指标
- 成本-效果权衡评估
- 长期稳定性测试

**潜在假设方向**:
- H-??? Agent Task Benchmark: 针对复杂多步任务的自动化评测框架
- H-??? Skill ROI Metric: Skill投入产出比的量化评估

## 追踪线索

- 项目: xbench-ai/xbench (GitHub)
- 社区: xbench官方账号
- 相关: WildToolBench, AgentIF, SWE-bench

---
*归档时间: 2026-04-03*  
*探索者: Amy-Kimi*
