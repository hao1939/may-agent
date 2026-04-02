# 中文Agent评测生态全景 — Deep Investigation

**Source**: insights-archive-20260225.md (Section I-VIII)
**Date**: 2026-02-25
**Trigger**: Bob专项任务 — 探索XHS帖子699dcbb5及整个中文Agent评测生态
**Type**: Deep cross-post synthesis (not a single post archive)

---

## Executive Summary

A single XHS post about "build evals on day one" (699dcbb5) triggered a systematic investigation into the entire Chinese AI agent evaluation ecosystem. The key finding: **Chinese and English evaluation communities are independently developing complementary frameworks that address different facets of the same problem — not a leader/follower dynamic.**

---

## Core Framework: 3 Agent Types × Evaluation Dimensions (699dcbb5)

| Agent Type | Chinese | Core Eval Dimensions |
|-----------|------|------------|
| **Independent service agent** | 独立服务型 | UX / expertise / trust / retention |
| **Tool-type agent** | 工具型 | functionality / accuracy / efficiency / security |
| **Role-type / multi-agent** | 角色型 | collaboration quality / communication efficiency / system performance / fault tolerance |

**Key insight**: This framework shifts evaluation from "technical metrics" to "role positioning." Different agent types serve different goals, so evaluation dimensions are fundamentally different.

**Complementarity with English frameworks**: English world (Hamel.dev, Anthropic, LangSmith) organizes by "evaluation layers": Unit Tests (L1) → Model/Human Eval (L2) → A/B Testing (L3). The 699dcbb5 framework organizes by "role type." These are orthogonal, complementary dimensions. Ideal eval = type classification × level classification.

---

## Four Independent Chinese Eval Frameworks

### 1. NikolaFu — Fault Diagnosis Evaluation (699c9dbd)
- **Perspective**: Not "is this agent good?" but "why did it suddenly collapse?"
- **Core**: 6-category session stability diagnosis framework
- **Key insight**: Real-world agent evaluation is often **fault diagnosis**, not **quality scoring**

### 2. 奥森木 — Embedded Self-Evaluation (Harness三件套)
- **Components**: Trace Analyzer + Self-Verify + Sandwich Reasoning Budget
- **Perspective**: Embed evaluation inside the agent's own execution loop
- **Unique**: Not external eval — agents evaluate themselves while running

### 3. VictoriaCity — Mission-Driven Self-Evolution Evaluation
- **Core**: "Drive agent growth through feedback design, not manual coding"
- **Perspective**: Feedback IS evaluation — what feedback signals you design determines what behaviors get reinforced
- **Principle**: "Only give goals + resources + feedback, don't assign specific tasks"

### 4. Sydney He — Failure Mode Classification (Agentic RL, Alibaba)
- **Distribution**: Strategy Error 33.6% (highest), Knowledge Gap 11.8%, Task Understanding 11.5%, Timeout 10.8%
- **Perspective**: Not "good/bad" but "failure type" — different failure types map to different fix paths
- **Cross-reference**: Tool-type failures are mainly Strategy Error + Knowledge Gap; Service-type mainly Task Understanding; Role-type mainly Timeout + collaboration breakdown

---

## Academic Evaluation Benchmarks (Chinese-specific)

| Benchmark | Date | Domain | Key Innovation |
|-----------|------|--------|----------------|
| MedBench v4 | 2025-11 | Medical AI Agent | Chinese vertical domain systematic eval |
| MobileBench-OL | 2026-01 | Mobile GUI Agent | Real-world environments, not sandboxes |
| LegalAgentBench | 2024-12 (Tsinghua) | Legal LLM Agent | Domain-specific reasoning patterns |
| LingxiDiagBench | 2026-02 | Psychiatry Multi-Agent | Real patient simulation + clinical validation |

**Common trend**: Chinese academic agent eval moving from general benchmarks toward **vertical domain × real scenarios × multi-turn interaction** three-dimensional evaluation.

---

## Prevention vs Diagnosis: Two Complementary Frameworks

| Dimension | NikolaFu (699c9dbd) | 699dcbb5 Framework |
|------|---------------------|-------------|
| When | **After problems** (diagnosis) | **From day one** (prevention) |
| Focus | Execution chain (rule→behavior mapping) | Evaluation system (goal→metric mapping) |
| Core question | Why did it collapse? | How do we know it's good enough? |
| Practice orientation | Fault troubleshooting manual | Quality assurance system |

**Synthesis**: Complete agent engineering practice = 699dcbb5's **preventive evaluation** (established day one) + NikolaFu's **diagnostic evaluation** (locate problems after they occur). One is the physical exam, the other is the operating room.

---

## Chinese Eval Community's Unique Advantages

1. **High practice density**: Rapid iteration environments (Coze, Dify, FastGPT) produce massive real failure cases
2. **Multi-level users**: Complete spectrum from independent service → tool → role type agents, all with real users sharing on XHS
3. **Framework practicality**: NikolaFu's "6 fault types" and 699dcbb5's "type-matched eval" both summarized from failure, not derived from theory

**English-invisible Chinese practices**:
- **Platform-embedded eval**: Coze/Dify workflows have built-in execution success rate tracking
- **Community pressure testing**: XHS/Weibo public display + real user comments create informal social A/B testing
- **Multi-agent role eval**: Chinese user community's rapid multi-agent experiments drive role-type agent evaluation refinement

---

## Meta-Insight

> The Chinese agent evaluation community is independently developing a practical framework system that exists parallel to English academic and tech blog communities, mutually uncited, but actually solving different facets of the same problem. This is not "Chinese community catching up to English" but "two communities deconstructing the same complex problem from different starting points."
