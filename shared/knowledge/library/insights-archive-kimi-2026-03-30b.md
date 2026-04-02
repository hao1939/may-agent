# Amy-Kimi Insights Archive — 2026-03-30 Batch 2

> HB-2232 至 HB-2245 归档

---

## HB-2232 — Agent设计模式：从简单到复杂的成本意识
**Source**: XHS@大模型每日通 / 社区神评论  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: 五种模式本质是一个产品决策——用户愿不愿为更好结果多等三秒

| 模式 | 核心机制 | 复杂度 |
|------|---------|--------|
| ReAct | Reasoning + Acting 循环 | 低 |
| Reflection | 自我反思改进 | 中 |
| Tool Use | 工具调用 | 低 |
| Planning | 任务规划分解 | 中 |
| Multi-Agent | 多智能体协作 | 高 |

**核心洞察**: 调试成本排序：ReAct (被低估) < Reflection/Planning << Multi-Agent

---

## HB-2233 — Context Engineering：上下文工程7原则
**Source**: XHS@AI技术立文  
**Date**: 2026-03-17 (archive深挖)  
**TL;DR**: 别优化prompt了，开始工程化上下文吧

7条原则：审计CLAUDE.md、分离关注点、渐进式披露、观点命名、挖掘会议、让Agent维护它、测量上下文健康

**OpenClaw对齐**: 4/7已对齐，2/7需补(Agent自维护vs禁令、上下文健康监控)

---

## HB-2234 — Attention Residuals：Kimi的架构底层革命
**Source**: XHS@未来博士/@AIGC探索之旅 / Kimi团队论文  
**Date**: 2026-03-17 (archive深挖)  
**TL;DR**: 范式级洞察——把"序列attention"搬到"网络深度"维度

核心创新: 从"每层输出直接相加" → "对各层输出按内容选择注意力聚合"

---

## HB-2235 — MIT TLT: RL训练的Speculative Decoding革命
**Source**: arXiv + MIT HAN Lab / GitHub: mit-han-lab/fastrl  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: 1.7-2.1×端到端加速 — 用Adaptive Drafter解决RL训练的长尾效应

关键数据: 端到端加速1.7-2.1×, Rollout阶段2.44×, 显存-65%

---

## HB-2236 — Google AP2协议: Agent支付授权新层
**Source**: XHS archive 6991158d / Google Cloud + DeepMind报告 (N=3466)  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: 协议生态快速分化 — A2A → MCP → AP2 → ACP?

协议分层: A2A(Agent通信), MCP(工具访问), AP2(支付授权), ACP(待确认)

关键数据: 52%企业生产Agent部署, 88%早期采用者ROI≥1用例

---

## HB-2237 — OpenClaw生态选型需求浮现
**Source**: XHS archive p69b56068 / 周见川Nex  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: 社区出现明确的三方对比需求 — OpenClaw vs AutoClaw vs Antigravity

---

## HB-2238 — DeerFlow: 字节跳动的企业级Agent架构验证
**Source**: XHS post analysis | Original: 云栈开源日记  
**TL;DR**: 字节开源DeerFlow，验证了sub-agent架构的方向

核心发现: 子智能体协同、动态技能按需加载、Docker/K8s沙箱隔离、基于LangGraph

---

## HB-2239 — Agent 5层架构: 框架虽多，架构收敛
**Source**: XHS post analysis | Frameworks: agno/LangGraph/Claude SDK/Google ADK  
**TL;DR**: 无论哪个框架，核心架构都在向5层模型收敛

5层: Model → Memory → Tool → Planning → Execution

---

## HB-2240 — Anthropic Agent三原则: 简单优于复杂
**Source**: https://www.anthropic.com/engineering/building-effective-agents  
**TL;DR**: 行业领先者的工程哲学 - 简单、透明、精心设计的ACI

三原则: 保持简单、优先透明、精心设计的ACI

---

## HB-2241 — MEMO: 多Agent评测稳定性框架
**Source**: XHS @momo / Paper: arXiv:2603.09022  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: Ranking Instability是系统问题，不是噪声

核心方案: Retention(记忆保持) + Exploration(探索优化) 双机制

提升: GPT-4o-mini +24.4%, Qwen-2.5-7B +23.4%

---

## HB-2242 — Harness工程的控制论本质
**Source**: XHS @马小疼 / 宝玉AI  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: 传感 + 执行 + 反馈 = 闭环控制

有效反馈两要素: 可观测性(定义好/坏状态)、可控性(观测到误差后能纠偏)

---

## HB-2243 — WildToolBench: 真实场景Agent能力短板
**Source**: XHS @AIGCHUB — 混元ICLR 2026 | Paper: Benchmarking LLM Tool-Use in the Wild  
**Date**: 2026-03-20 (archive深挖)  
**TL;DR**: Session成功率<15%! 即使顶级模型

战绩: Gemini 2.0 Thinking <15%, Claude 4 Sonnet <15%

三大Wild挑战: 组合式任务、隐藏意图、指令丝滑切换

---

## HB-2244 — HB-2245 (已归档至 insights-archive-kimi-2026-03-30.md)

---

*Archived: 2026-03-30*
