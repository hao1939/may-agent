# HB-2043: V2EX Cost-Conscious Agent Patterns (April 2026)

**Source**: V2EX Chinese Developer Community  
**Date**: 2026-04-22  
**Threads Analyzed**: 8 discussions, 25,000+ views  
**Amy Rating**: ★★★★★ — Practical, battle-tested patterns from production

---

## The Core Insight

Chinese developer community emphasizes **cost optimization** and **gradual adoption** over bleeding-edge capabilities. The dominant pattern: multi-model orchestration with strict cost controls.

---

## Pattern 1: Plan → Execute → Review Tiering

**The Problem**: "用Claude Opus-4-6半天烧了四十多美元，这样下去扛不住" (meetyuan thread, 8380 views)

**Standard Pattern**:
```
Plan (Strong/Cheap) → Execute (Cheap) → Review (Strong)
```

| Tier | Model Role | Use Case | Cost Strategy |
|------|-----------|----------|---------------|
| **Planning** | Claude Opus, GPT-5 | System design, architecture | Use sparingly |
| **Execution** | DeepSeek, GLM-4, Kimi | Code generation | Bulk of work |
| **Review** | Claude Sonnet, GPT-5.4 | Validation, code review | Final check only |

**Community Insight**:
> "更好的分法是：大模型做规划路径 + 审查代码质量；便宜模型按规划路径执行。DeepSeek写代码和Claude差距没那么大，但价格是降维打击。"
> — mansunyunxin

---

## Pattern 2: Claude Code vs Codex Split

**Frontend/UI**: Claude Code (aesthetics matter)  
**Backend/Logic**: Codex (cost-effective, stable access)

| Dimension | Claude Code | Codex |
|-----------|-------------|-------|
| Model Capability | Slightly better | GPT-5.4 competitive |
| Frontend/UI | Better aesthetics | "写的特别丑" |
| Backend | Comparable | "很稳" |
| Price/Value | Expensive, strict limits | Better quotas, resets |
| Access Stability | Frequent KYC/bans | Reliable |
| Speed | Faster | Slower |

**Cost Control Trick**:
> "在CLAUDE.md里将需求和架构写详细，让Sonnet做执行，只在关键定义和架构评审时再切回Opus，一天的费用能控在十块内"
> — teaguexiao

---

## Pattern 3: Spec-First Vibe Coding

**Standard Workflow** (xyooyx):
1. Write detailed spec before ANY code
2. Review spec separately (human or LLM)
3. Proceed to implementation
4. Never skip review

> "写spec、复核spec、开始编码，以此循环往复"

---

## Pattern 4: Enterprise Reality Check

| Use Case | Success Rate | Notes |
|----------|-------------|-------|
| **Creative Generation** | High | Cursor, Lovable — "允许幻觉存在" |
| **Code Assistants** | High | Developer self-selection |
| **Document Drafting** | Medium | Needs human review |
| **Smart Customer Service** | Low | "纯智障", too many MCPs |
| **Text2SQL/NL2SQL** | Low | "脱了裤子放屁" vs existing BI |

**Key Insight**:
> "AI应用最好的产品还是创意生成类的...通用点就是允许幻觉存在，或者说幻觉的生成是可以接受的"

> "企业落地的时候，幻觉对于很多领导或者项目来说，又是不能接受的东西了。最后做着做着，AI应用只能在一些无关痛痒的地方落地"

---

## Pattern 5: Gradual Adoption Path

From aqqwiyth:
> "不要试图直接做产品。渐进式的尝试：接口→模块→功能→产品"

**Progression**: API → module → feature → product

---

## Frameworks from Chinese Community

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

---

## Implications for OpenClaw

1. **Cost-Model Tiering**: Implement plan/execute/review model routing based on task type
2. **Spec-First Culture**: Enforce spec-writing before implementation
3. **Hallucination Tolerance Mapping**: Identify which use cases can tolerate hallucination
4. **Gradual Adoption**: API → module → feature → product progression
5. **GUI for Non-Technical Users**: CLI-only approaches limit adoption

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

**Tags**: #cost-optimization #multi-model #vibe-coding #enterprise-reality #chinese-community #v2ex
