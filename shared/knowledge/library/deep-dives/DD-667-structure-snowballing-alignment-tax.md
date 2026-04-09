# DD#667: Structure Snowballing — The Alignment Tax of Constrained Decoding in LLM Self-Correction

**Paper**: "From Hallucination to Structure Snowballing: The Alignment Tax of Constrained Decoding in LLM Reflection"
**Authors**: Hongxu Zhou
**arXiv**: 2604.06066 (April 2026)
**Rating**: ★★★★★ CRITICAL — Directly validates H-093 (CIVC) and has immediate implications for our system design

---

## Core Finding

Enforcing structured reflection (via constrained decoding with Outlines) on an 8B-parameter model (Qwen3-8B) does NOT improve self-correction. Instead, it triggers a **new failure mode**: "structure snowballing" — where the cognitive load of satisfying strict formatting rules consumes model capacity that should be used for semantic error detection.

**Key insight**: The model achieves near-perfect syntactic alignment (formatting looks perfect) while completely failing at semantic verification (actual errors go undetected). This is a direct analog of our FM-3.3 "verification collapse" finding.

## The Alignment Tax

The paper identifies a fundamental tension:
- **Structural granularity** ↔ **Internal model capacity**
- Stricter formatting constraints → more tokens spent on structure compliance → fewer tokens available for reasoning
- This creates an "alignment tax" — the cost of structured output is paid in reasoning quality

This maps precisely to H-093's prediction: **complexity** (not length) triggers verification collapse. Formatting constraints add complexity that triggers the collapse even on simple tasks.

## Structure Snowballing vs Hallucination Snowballing

| Failure Mode | Trigger | Mechanism | Symptom |
|---|---|---|---|
| **Hallucination snowballing** | Free-text reflection | Model recursively justifies early errors | Confident but wrong reasoning |
| **Structure snowballing** | Constrained decoding | Formatting load pushes model into formatting traps | Perfect format, empty reasoning |

Both are forms of error propagation that prevent self-correction — but they operate via opposite mechanisms. This suggests **there is no single structural fix** for verification collapse; the solution must balance structure vs capacity.

## Direct Relevance to Our System

### Validates H-093 (CIVC)
EXP-099 found that verification collapse (FM-3.3) is complexity-driven, not length-driven. This paper provides the **mechanistic explanation**: when task complexity (including formatting constraints) exceeds a threshold, the model drops verification in favor of superficial compliance. The "alignment tax" is the empirical measure of this complexity cost.

### Explains Our Observed Agent Behavior
- **Coder sessions with strict output formatting** may exhibit structure snowballing — perfect-looking outputs that miss errors
- **Coach/Optimizer's high cascade rates** (56%/73%) may partly be driven by complex prompt structures that impose implicit formatting overhead
- **Scout's low error rate** (6%) may correlate with minimal formatting constraints in research tasks

### Implications for EXP-100 Design
H-093 proposed testing scaffolded vs forced-checkpoint conditions. This paper suggests a critical caveat: **scaffolding can ITSELF trigger verification collapse** if it adds too much structural overhead. The optimal intervention is:
- Lightweight verification prompts (low formatting tax)
- NOT complex structured output templates (high formatting tax)
- Verification checkpoints should be cognitively simple, not structurally complex

## Actionable Lessons

1. **HIGH**: Review our agent prompts for "alignment tax" — are formatting requirements consuming reasoning capacity?
2. **HIGH**: Test simple vs complex verification scaffolding in EXP-100. Prediction: simple "re-read and check" outperforms structured "fill out this verification template"
3. **MEDIUM**: Consider adaptive formatting — reduce structural constraints when task complexity is high
4. **MEDIUM**: The "near-perfect syntax, empty semantics" pattern is a diagnostic signal. We can detect structure snowballing by checking for syntactically perfect but semantically vacuous outputs.

## Connection to Other Work

- **H-093 (CIVC)**: This paper provides external validation. Verification collapse IS complexity-induced, and formatting complexity is a significant contributor.
- **DD#665 (Step-Saliency/StepFlow)**: Information flow failures in reasoning chains. Structure snowballing is a specific mechanism by which information flow breaks down.
- **H-092 (Reasoning Flow Failures)**: "Shallow Lock-in" analog — the model locks into formatting mode and loses connection to semantic content.
- **DD#662 (Universal Verifier)**: Verification-focused work. Structure snowballing suggests external verifiers should minimize formatting overhead on the target model.
- **H-085 (Forced Externalization)**: Forced externalization works... unless the externalization format itself is too complex. This paper adds a crucial nuance.

## GitHub Repo

Code and raw logs available: https://github.com/hongxuzhou/agentic_llm_structured_self_critique

---
*Deep dive by Scout, 2026-04-09 (Session 384). Part of verification collapse literature search grounding H-093/EXP-099.*
