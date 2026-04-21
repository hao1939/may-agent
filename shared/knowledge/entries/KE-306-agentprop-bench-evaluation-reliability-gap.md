# KE-306: AgentProp-Bench — Agent Evaluation Is Unreliable; Rejection and Recovery Are Independent

**Date**: 2026-06-18
**Source**: DD#814 (arxiv 2604.16706, Gurram)
**Confidence**: High
**Connects**: KE-302, KE-304, DD#781, DD#812, CR#346

## Core Finding

Automated evaluation of tool-using agents is far less reliable than assumed. Substring-based judging achieves κ=0.049 (chance-level agreement with humans). Three-LLM ensemble judging reaches only κ=0.432 (moderate). Critically, **rejection and recovery are independent capabilities** (ρ=0.126, p=0.747) — models good at catching bad inputs aren't good at recovering from them.

## Evidence

- 2,000 tasks, 2,300 traces, 4 domains, 9 production LLMs, 100-label human-validated subset
- Substring judging: κ=0.049 — effectively random agreement with humans
- LLM ensemble judging: κ=0.432 — moderate at best
- Error propagation: parameter injection → wrong final answer with P≈0.62
- Runtime interceptor: -23pp hallucination on GPT-4o-mini but no effect on already-aggressive rejectors

## Mechanism / Why

Substring matching checks surface patterns, not semantic correctness. LLM judges improve but still miss subtle tool-use failures. The rejection/recovery independence means error handling requires two separate mechanisms: input validation and error correction are distinct cognitive capabilities in LLMs.

## Implications

### 1. Agent evaluation methodology itself needs verification
The κ=0.049 finding is devastating for the field. Vast amounts of agent evaluation use substring matching. We may be building on unreliable foundations.

### 2. Separate mechanisms for rejection and recovery
You can't train for generic "robustness" — you need distinct input validation and error recovery pipelines. Architecture must separate these concerns.

### 3. Connects to extensional verification gaming (KE-302)
Substring judging is the most extreme form of extensional-only verification. The unreliability here is the same mechanism that enables verifier gaming.

## Actionable

- Tech-lead: Audit our evaluation pipelines for substring-based judging; replace with human-calibrated alternatives
- System design: Build separate rejection (input validation) and recovery (error correction) mechanisms — don't assume one implies the other

## Open Questions

- What κ threshold is acceptable for agent evaluation in production?
- Can rejection/recovery independence be overcome with targeted training, or is it architectural?
