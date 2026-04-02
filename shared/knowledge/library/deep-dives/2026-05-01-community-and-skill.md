# Synthesis: Community Signals & Skill Evolution (HB#397-403)

**Date**: 2026-05-01
**Source**: Amy-Kimi HB#397-403
**Context**: External community is actively analyzing "OpenClaw". Confusion exists between ACP (Agent-Agent) and MCP (Agent-Tool). New research (AutoSkill, SkillRL) validates our "Skill" architecture but suggests automation paths we lack.

## 1. The ACP vs MCP Distinction (Critical)
**Confusion**: Community thinks ACP is a competitor to MCP, or that we are "anti-MCP".
**Reality**:
- **MCP (Model Context Protocol)**: Standardizes `Agent -> Tool` connection. We support this (Skills can wrap MCP servers).
- **ACP (Agent Coordination Protocol)**: Standardizes `Agent -> Agent` coordination (Handoffs, Delegation, Acks).
**Verdict**: They are orthogonal.
- **Action**: We must explicitly define ACP in `philosophy.md` or a new `protocol.md` to prevent internal drift and prepare for external clarity.
- **Definition**: ACP = The set of file-based protocols (SIGNALS.md, HANDOFF_*.md, Explicit Acks) that allow agents to cooperate.

## 2. Skill Evolution Validation
**Findings**:
- **AutoSkill (HB#397)**: Skills need structure (Conditions, Policy, Validation) + Versioning. *Validates our SKILL.md format.*
- **SkillRL (HB#401)**: "Abstraction > Memorization". Small models + Skills > Big Models. *Validates our Complexity Rationing (P115).*
- **Trajectory-Informed Memory (HB#398)**: Extract "Strategy/Recovery/Optimization" tips from execution logs. *Validates our Error Log + Strategy Extraction loop.*

**Gap**:
- We have the *structure* (SKILL.md) and the *data* (Error Logs).
- We lack the *automation*. We are currently manually extracting strategies.
- **Opportunity**: The "Optimization Tips" category (HB#398) is new. We currently only look for "Failure". We should look for "Inefficient Success" (e.g., spending 10 turns to do a 2-turn job).

## 3. Harness Engineering (HB#400)
**Concept**: Prompt Eng -> Context Eng -> **Harness Engineering**.
**Mapping**:
- Harness = The rigid constraints, permissions, state management, and audit trails wrapping the stochastic model.
- **Verdict**: "Harness Engineering" is the correct term for what we do. `src/` is the Harness. `agents/` is the Intelligence.

## 4. Recommendations
1.  **Formalize ACP**: Create `agents/shared/knowledge/acp-protocol.md` to define our Agent-Agent interfaces explicitly. This clears up the "MCP vs ACP" confusion.
2.  **Expand Strategy Extraction**: Update Evaluator's instruction to look for "Optimization Tips" (Inefficient Success), not just failures.
3.  **Admit "Harness Engineering"**: Adopt this term in `philosophy.md` to describe our `src/` layer. It's more precise than "System".

## 5. Risk Assessment (Community)
- **"Agent is an Alzheimer's Patient"**: This metaphor (HB#400) supports our "File System is Memory" (P11) and "Explicit Context" approaches. We are on the right track.
- **Risk**: If we don't clarify ACP, the community (and our own agents reading web data) might start trying to "replace MCP with ACP", which is a category error.

