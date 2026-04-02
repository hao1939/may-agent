# Harness Engineering — Convergent Discovery Across Independent Sources

**Source**: insights-archive-2026-03-13-amy-kimi.md (HB#103)
**Date**: 2026-03-13
**Type**: Multi-source convergence analysis — 3 independent authors arriving at the same concept

---

## Executive Summary

Three independent XHS authors — 李泽 (AI 超级个体), CuiLiang.ai (305♥/603⭐), and the Amy-Kimi system itself — independently developed overlapping frameworks for what the industry is calling "Harness Engineering." This represents a genuine convergence signal: when multiple independent observers identify the same pattern, it's likely structural rather than faddish.

---

## The Three-Stage Evolution

| Stage | Scope | Core Question |
|-------|-------|---------------|
| **Prompt Engineering** | "This one turn" | How do I phrase this question? |
| **Context Engineering** | "What the model sees" | What information should the model have? |
| **Harness Engineering** | "The entire work session" | How does the full run complete reliably? |

---

## 李泽's Metaphor: The Airport System

> "AI本身当然重要，但它越来越像发动机；决定它能不能持续起飞的，是它所处的机场系统。"
> ("AI itself matters, but it's increasingly like an engine; what determines whether it can take off sustainably is the airport system it operates within.")

**OpenAI Codex evidence**: 5 months → 1 million lines of code, 1,500 PRs, almost no human-written code.

**Key claim**: 
> "多写prompt是徒劳的，给AGENTS.md里添加一大堆规则也是徒劳的。"
> ("Writing more prompts is futile; adding tons of rules to AGENTS.md is also futile.")

---

## CuiLiang.ai's Five-Dimension Framework (305♥/603⭐)

> "在Agent系统中，系统设计（Harness）对性能的影响甚至超过了模型本身的能力。"

| Dimension | Content | OpenClaw Mapping |
|-----------|---------|-----------------|
| 🔧 Tool Interface | MCP/skills/whitelist | Gateway Skill Registry |
| 🚧 Execution Boundary | Approval/confirmation mechanisms | Gateway Policy Layer |
| 📋 State Management | Persistent memory and checkpoints | Self-Improvement Pool |
| 🔍 Audit Trail | Complete behavior logs | Channel Event Log |
| 🔄 Feedback Loop | Error correction and continuous improvement | AGENTS.md iterative updates |

**Critical distinction from comments**: 
- **Runtime** harness = tool boundaries, state management, audit → infrastructure
- **Development-time** harness = AGENTS.md, skills definition, workflow design → configuration

These are often confused but require different engineering approaches.

---

## Amy-Kimi's Independent Validation

Reviewing the entire post corpus, Amy independently identified the same pattern in the 457-post cross-synthesis (BACKFILL-003):

| 457-Post Insight | Harness Engineering Equivalent |
|-----------------|-------------------------------|
| "Passive injection beats active retrieval" | Harness = making the right information structurally unavoidable |
| "Context is reliability infrastructure, not cost" | Harness > Prompt — system design > model intelligence |
| "Memory isolation is the real multi-agent problem" | State Management dimension of CuiLiang.ai's framework |

---

## Practical Implications

### What IS Harness Engineering (具体包含):
1. **Document placement** — where information lives determines if it's seen
2. **Code search** — how the agent finds relevant code
3. **Task decomposition** — how complex work gets broken into executable pieces
4. **Test verification** — how the agent knows it succeeded
5. **Log inspection** — how the agent understands what happened
6. **Human intervention triggers** — when to escalate vs. continue autonomously
7. **Error non-repetition mechanisms** — how the same mistake is prevented twice

### What IS NOT Harness Engineering:
- Writing better prompts (that's Prompt Engineering)
- Curating better context (that's Context Engineering)
- Making the model smarter (that's Model Engineering)

---

## Convergence Evidence Score

| Signal | Strength |
|--------|----------|
| Number of independent sources | 3+ (strong) |
| Geographic diversity | China-based but citing global work (medium) |
| Time clustering | All within ~2 weeks of each other (strong) |
| Engagement levels | CuiLiang.ai at 305♥/603⭐ (very strong) |
| Actionability | Specific 5-dimension framework (strong) |

**Assessment**: This is a genuine conceptual convergence, not a meme or trend. The concept has architectural implications worth implementing.

---

## L3 Flags (from original)
- **#215**: Harness三阶段演进：PE→CE→HE，竞争焦点转向"机场系统"
- **#219**: Harness五维度框架：工具接口/执行边界/状态管理/审计/反馈闭环
- **#220**: Agent最小三模块：LLM+Tool System+Agent Loop — 大道至简
