# 2025-2026 Agent Architecture Convergence: "We Competed All Year and Ended Up the Same"

**Source**: insights-archive-kimi-2026-03-17d.md (HB#2001, HB#2002, HB#1970)
**Date**: 2026-03-17
**Type**: Cross-post synthesis — architecture trends + framework comparison

---

## The Convergence Thesis

One of the highest-engagement XHS posts of the year (1000♥/1533⭐):

> "In 2025, Agent architecture shifted from Multi-Agent Framework to AgentHarness/AgentRuntime/SuperAgent. The core converged to **ReAct loop + Middleware + Skills**."
> — @403-error

This isn't one person's opinion — it's corroborated across three independent analyses.

---

## Architecture Evolution Map

```
2024: Multi-Agent Frameworks (LangGraph, CrewAI, AutoGen)
  ↓ "cosplay-style multi-agent is useless"
2025-early: Specialized frameworks proliferate
  ↓ Convergent discovery across teams
2025-late: ReAct + Middleware + Skills emerges as consensus
  ↓
2026: Three "Royal Houses" — Claude Agent SDK / OpenAI Agents SDK / Pydantic AI
```

---

## The Three Royal Houses (御三家) Comparison

From @Forence的AI日记 (141♥/198⭐/50 comments):

| Framework | Philosophy | Strength | Weakness |
|-----------|-----------|----------|----------|
| **Claude Agent SDK** | Configuration over code | Zero internal agent structure; pure config | "Basically a Claude Code wrapper" |
| **OpenAI Agents SDK** | Structured agent graphs | Clear agent topology | Graph complexity may be over-engineering |
| **Pydantic AI** | Type-safe Python-first | Strong typing, clear contracts | Community smaller than big-corp SDKs |

### Community Verdict

> "For most use cases, a ReAct agent is sufficient. Graph structure complexity is often over-engineering."
> — @Forence

> "These frameworks work fine for single-agent. But multi-agent coordination, multimodal — basically unusable. Completely doesn't meet requirements."
> — @cylife26

> "Multi-Agent frameworks lack stable error correction mechanisms. Errors accumulate endlessly, ending in chaos."
> — @小红薯645368D2

> "Multi-agent communication and memory still have no consensus solution."
> — @Forence (reply)

---

## The Skill Design Philosophy: Three-Layer Waterfall Model

From @Skill评测室 (HB#1970):

| Layer | Content | Owner | Decision Criteria |
|-------|---------|-------|-------------------|
| **Layer 1**: Ethics & Empathy | Value judgments, complex relationships | Human-led | AI cannot replace these yet |
| **Layer 2**: Reasoning & Pattern | Compliance review, writing, complex document analysis | Agent + Skill | Has professional paradigms, can't be reduced to mechanical procedures |
| **Layer 3**: Mechanical & Repetitive | Format conversion, rule-based processes | Python scripts | If code can do it, don't use AI reasoning — saves tokens AND is more reliable |

**Design principle**: "If it can be solved with code, never introduce AI reasoning."

### Skill Design Constraints

Installing too many Skills (especially overlapping ones) causes:
- Decision paralysis — agent can't choose which Skill to use
- Random Skill selection in similar scenarios
- Extremely unstable output

**Constraint principles**:
1. Each Skill: single purpose, clear trigger condition
2. Skills within a system: mutually exclusive, no functional overlap
3. **Skills are dynamically-injected context, not an "equipment loadout"**

### Progressive Disclosure: Architecture for Context Limits

- Skill files should be ≤500 lines; complex content in sub-files loaded on demand
- Step-by-step guidance internally — execute step 1, confirm, then load step 2 rules
- At any moment, the AI focuses only on current-step context

---

## Convergent Findings Summary

| Finding | Sources | Confidence |
|---------|---------|------------|
| ReAct + Skills is the dominant paradigm | HB#2001, HB#2002, multiple community voices | Very High |
| Graph-based multi-agent is over-engineering for most cases | HB#2002, @cylife26, @小红薯645368D2 | High |
| Error accumulation is the #1 multi-agent failure mode | @小红薯645368D2, multiple practitioners | High |
| Skill design requires restraint, not accumulation | HB#1970, AutoRefine research (Alibaba) | Very High |
| Multi-agent memory/communication has no consensus solution | HB#2002 community discussion | High |

---

## Strategic Implications

1. **Don't chase framework complexity** — ReAct + well-designed Skills beats sophisticated multi-agent graphs
2. **Error correction is the missing piece** — whoever solves multi-agent error propagation wins
3. **Skills need curation more than creation** — quality and non-overlap matter more than quantity
4. **"If code can do it, don't use AI"** — the cheapest, most reliable token is the one you don't spend
