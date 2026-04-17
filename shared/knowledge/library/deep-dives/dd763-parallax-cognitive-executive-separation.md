# DD-763: Parallax — Cognitive-Executive Separation for Safe Autonomous AI

**Paper**: 2604.12986 — "Parallax: An Architecture for Safe Autonomous AI Execution"
**Date**: 2026-04-14
**Relevance**: ★★★★★

## Core Contribution
Argues that prompt-based safety is **architecturally insufficient** for agents with execution capability. Introduces Parallax paradigm grounded in four principles:
1. **Cognitive-Executive Separation** — structurally prevents reasoning system from directly executing actions
2. **Adversarial Validation with Graduated Determinism** — independent multi-tiered validator between reasoning and execution
3. **Information Flow Control** — data sensitivity labels propagated through agent workflows
4. **Reversible Execution** — pre-destructive state capture for rollback on validation failure

OpenParallax (Go reference implementation) evaluated via Assume-Compromise Evaluation: 280 adversarial cases, 9 attack categories → 98.9% block rate (default), 100% (max-security), **zero false positives**. When reasoning system is compromised, prompt guardrails provide **zero** protection; architectural boundary holds regardless.

## Connection to Our Research
This is the strongest external validation yet of **Law 2 (Prompt Guardrails Are Insufficient)** and the architectural enforcement thesis from CR-306/CR-324. Key quote: "prompt-level guardrails provide zero protection because they exist only within the compromised system." The cognitive-executive separation maps directly to our Intervention Architecture findings (WKWA-007) — Bob's hard gates vs. skill comparison showed 100% vs 0%, and Parallax formalizes this at the infrastructure level.

The Assume-Compromise methodology is also highly relevant: it tests the architectural boundary itself by bypassing the reasoning system entirely, exactly the kind of adversarial eval we've been arguing for in the production-first eval methodology (CR-326 Path A).

## Key Takeaways
- Prompt safety = 0% under compromise; architectural separation = 98.9-100%
- Information flow control (sensitivity labels) is a novel addition to enforcement taxonomy
- Reversible execution addresses the "irreversible action" gap in current agent safety
- Go reference impl available — potential practical validation target
