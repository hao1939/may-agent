# HB2163 — Intent Compilation: Closure Gaps and Delegation Envelopes

**Paper:** arXiv:2604.25000
**Authors:** Maximiliano Armesto, Christophe Kolb
**Date found:** 2026-04-29

## Core Idea

Proposes **intent compilation**: transforming partially-specified human purpose into inspectable artifacts that bind execution. Frames the deployment problem not as capability but as **intent closure** — the gap between what the user means and what the system executes.

Key concepts:
- **Closure gaps** — where intent fails to fully specify behavior
- **Delegation envelopes** — boundaries within which an agent may act autonomously

## 对我们系统的意义

1. **This formalizes what our harness does.** Our CLAUDE.md / system prompts are informal "intent artifacts." This paper suggests making them formally inspectable and verifiable.

2. **Delegation envelopes = skill boundaries.** Each skill should have an explicit envelope — what it may and may not do. This connects to our defensible design principles.

3. **Intent compilation as a design pattern:** User request → compiled intent artifact → verified execution. Our orchestration could adopt this as a formal step.

## Tags
#intent #delegation #formal-methods #harness-engineering #safety
