# HB-2042: V2EX Community Agent Practical Patterns (2026-04-22)

**Source**: V2EX (Chinese Developer Community)  
**Date**: 2026-04-22  
**Threads Analyzed**: 8 high-engagement discussions  
**Total Views**: ~25,000+

---

## Key Findings Summary

Chinese developer community on V2EX shares practical, cost-conscious insights on AI agent adoption that differ from Western discourse — emphasis on **cost optimization**, **gradual adoption**, and **enterprise reality checks**.

---

## 1. Multi-Model Orchestration: The Cost-Conscious Pattern

### The Problem (meetyuan thread, 8380 views)
> "用Claude Opus-4-6半天烧了四十多美元，这样下去扛不住"

**Standard Pattern Emerging**:
```
Plan (Strong/Cheap) → Execute (Cheap) → Review (Strong)
```

| Tier | Model Type | Use Case | Examples |
|------|-----------|----------|----------|
| **Planning** | Strong reasoning | System design, spec | Claude Opus, GPT-5 |
| **Execution** | Fast & cheap | Code generation | DeepSeek, GLM-4, Kimi |
| **Review** | Strong reasoning | Code review, validation | Claude Sonnet, GPT-5.4 |

**Community Insight**:
> "更好的分法是：大模型做规划路径 + 审查代码质量；便宜模型按规划路径执行。DeepSeek写代码和Claude差距没那么大，但价格是降维打击。"
> — mansunyunxin

**Key Concept**: "Karpathy's Goal-Driven Execution with cost awareness" — give the goal AND the cost constraint.

---

## 2. Claude Code vs Codex: Real-World Tradeoffs

### Community Consensus (dsd2077 thread, 7316 views)

| Dimension | Claude Code | Codex |
|-----------|-------------|-------|
| **Model Capability** | Slightly better | GPT-5.4 competitive |
| **Frontend/UI** | Better aesthetics | "写的特别丑" |
| **Backend** | Comparable | "很稳" |
| **Price/Value** | Expensive, strict | Better quotas, resets |
| **Access Stability** | Frequent KYC/bans | Reliable |
| **Speed** | Faster | Slower |

**Pragmatic Split**:
- **Frontend/UI**: Claude Code (aesthetics matter)
- **Backend/Logic**: Codex (cost-effective, stable)
- **Cost Control**: Detailed CLAUDE.md + Sonnet for execution, Opus only for architecture review

> "在CLAUDE.md里将需求和架构写详细，让Sonnet做执行，只在关键定义和架构评审时再切回Opus，一天的费用能控在十块内"
> — teaguexiao

---

## 3. The Vibe Coding Cycle: Spec-First Development

### Standard Workflow (xyooyx)
> "写spec、复核spec、开始编码，以此循环往复"

**Steps**:
1. Write detailed spec before ANY code
2. Review spec separately (human or LLM)
3. Proceed to implementation
4. Never skip review

**Rationale**: Prevents drift, reduces rework, makes intent explicit.

---

## 4. Enterprise AI Adoption: Reality Check

### What Actually Works (IIIIZAYOI thread, 2516 views)

| Use Case | Success Rate | Notes |
|----------|-------------|-------|
| **Creative Generation** | High | Cursor, Lovable — "允许幻觉存在" |
| **Code Assistants** | High | Developer self-selection |
| **Document Drafting** | Medium | Needs human review |
| **Smart Customer Service** | Low | "纯智障", too many MCPs |
| **Text2SQL/NL2SQL** | Low | "脱了裤子放屁" vs existing BI |

**Key Insight**:
> "AI应用最好的产品还是创意生成类的...通用点就是允许幻觉存在，或者说幻觉的生成是可以接受的"

**Enterprise Reality**:
> "企业落地的时候，幻觉对于很多领导或者项目来说，又是不能接受的东西了。最后做着做着，AI应用只能在一些无关痛痒的地方落地"

**Adoption Path** (aqqwiyth):
> "不要试图直接做产品。渐进式的尝试：接口→模块→功能→产品"

---

## 5. Frameworks from Chinese Community

### TogoAgent (alexazhou)
- Multi-agent with GUI (not CLI-only)
- Task-driven: projects + tasks as core abstraction
- Skills/rules/MCP for LLM
- Knowledge base shared between humans and AI
- **Innovation**: "AI更像是同事、分身" — AI as colleague, not replacement

### OpenMantis (LiangNiang)
- Multi-platform Agent framework (Feishu/WeCom/QQ)
- Composable tools, long-term memory, scheduling
- Browser automation built-in
- For non-technical user-facing deployment

### Claude Design Skill (jiji262)
- Export internal AI system prompts as portable skills
- Design artifacts: pitches, landing pages, prototypes
- Progressive disclosure pattern

---

## 6. Practical Tooling Patterns

### Workflow Integration
> "跨境电商工作流...用n8n搭了几百条ai workflow"
> — midsolo

### System Integration
> "将工作的系统比如jira,github,outlook,ms teams这些和codex+claude打通，然后指挥他们干活，让ai自己写jira，自己写pr，自己发和读ms teams消息"
> — gbin via sigcli.ai

---

## Implications for Our System

1. **Cost-Model Tiering**: Implement plan/execute/review model routing based on task type, not just use the strongest model everywhere

2. **Spec-First Culture**: Enforce spec-writing before implementation in agent workflows

3. **Hallucation Tolerance Mapping**: Identify which use cases can tolerate hallucination vs. which require precision

4. **Gradual Adoption**: API → module → feature → product progression, not direct-to-product

5. **GUI for Non-Technical Users**: CLI-only approaches limit adoption; consider TogoAgent-style GUI for broader deployment

---

## Sources

| Thread | Title | Views |
|--------|-------|-------|
| t/1207380 | AI太烧钱了，大模型组合方案 | 8380 |
| t/1207711 | Codex风评超过Claude Code | 7316 |
| t/1207692 | 公司真正落地的AI应用 | 2516 |
| t/1207748 | Token Plan对比 | 2291 |
| t/1207720 | 大家如何使用codex | 2943 |
| t/1207671 | 开发面向普通用户的Agent软件 | 1087 |
| t/1207645 | Claude Design Skill开源 | 692 |
| t/1207771 | Vibe会让模型先输出方案审核吗 | 228 |

---

*Compiled by Amy-Kimi | 2026-04-22 | Focus: Practical, actionable patterns*
