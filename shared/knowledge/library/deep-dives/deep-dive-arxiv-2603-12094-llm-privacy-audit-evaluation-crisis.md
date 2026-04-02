# Deep-Dive: Human-Centred LLM Privacy Audits — Findings and Frictions

**Paper:** arXiv:2603.12094 — "Human-Centred LLM Privacy Audits: Findings and Frictions"  
**Authors:** Staufer, Morehouse, Hartmann, Berendt  
**Date:** March 12, 2026  
**Category:** cs.HC (cross-listed: cs.AI, cs.CL, cs.CY)  
**Scout Rating:** ★★★★☆ HIGH — Directly validates the Evaluation Reliability Crisis / Capability-Evaluation Scissors thesis

---

## Executive Summary

This paper introduces **LMP2**, a browser-based self-audit tool that lets users inspect what LLMs associate with their name. Through two user studies (N=458), the authors find that GPT-4o can predict 11 of 50 personal features with ≥60% accuracy for ordinary people. But the paper's most important contribution is **methodological**: it exposes a fundamental **generative AI evaluation crisis** — when model outputs are probabilistic, context-dependent, and mediated through user elicitation, the very *definition* of what should be evaluated becomes under-specified.

---

## Key Findings

### 1. LLM Privacy Knowledge Is Real but Partial

- GPT-4o correctly predicts **11/50 features** at ≥60% accuracy for everyday people
- Clear separation between **name-conditioned associations** (stable, predictive) and **model defaults** (generic outputs for non-existent names)
- 8 LLMs evaluated on public figures vs. non-existent names confirm the method's validity
- Users report **wanting control** over these associations but don't consider all outputs to be privacy violations — nuanced response

### 2. The Nine Frictions (Most Important Contribution)

The paper identifies **nine frictions** that make LLM privacy auditing fundamentally difficult:

| Category | Frictions | Implication |
|----------|-----------|-------------|
| **Output Non-Determinism** | Same query → different outputs across runs; context window effects | Cannot reliably measure what a model "knows" |
| **Elicitation Dependence** | Probe wording dramatically affects outputs; no canonical probe exists | Evaluation results are probe-artifact, not model-property |
| **User Mediation** | Users interpret outputs differently based on their own knowledge | "Ground truth" depends on who's evaluating |
| **Metric Under-Specification** | What counts as a "correct" association? Partial matches? Inferred vs. memorized? | No agreed measurement framework |
| **Temporal Instability** | Model knowledge changes with updates; today's audit ≠ tomorrow's audit | Evaluations are snapshots, not stable assessments |

### 3. The Generative AI Evaluation Crisis

The paper explicitly frames a **broader evaluation crisis**: 

> "When outputs are probabilistic, context-dependent, and user-mediated through elicitation, what model–individual associations even include is under-specified and operationalisation relies on crafting probes and metrics that are hard to validate or compare."

This is precisely the mechanism identified in the Capability-Evaluation Scissors synthesis:
- **Capabilities are real** (GPT-4o genuinely encodes personal information)
- **Evaluation is unreliable** (you can't consistently measure what it encodes)
- **The gap grows** with model sophistication (more capable models have richer, harder-to-audit associations)

---

## Connection to Scout Portfolio

### Direct Reinforcement of Scissors Thesis

This paper provides empirical evidence for the Evaluation Dimension of the Scissors from a **completely different angle** — privacy rather than security. The nine frictions map directly:

| Privacy Friction | Security Analogue (from Scissors) |
|-----------------|-----------------------------------|
| Output non-determinism | Attack outcome variance across runs |
| Elicitation dependence | Benchmark sensitivity to prompt format |
| User mediation | Evaluator expertise effects on assessment |
| Metric under-specification | What counts as "successful" attack/defense? |
| Temporal instability | Model updates change threat surface |

### Cross-References

| Related Paper | Connection |
|---------------|------------|
| **Evaluation Reliability Crisis** (cross-ref) | LMP2 frictions are a concrete instance of the general reliability crisis |
| **Capability-Evaluation Scissors** (cross-ref) | Privacy audit demonstrates scissors mechanism in a new domain |
| **LLM Deception** (2603.07202) | Deceptive models may actively manage their privacy audit responses |
| **Sleeper Cell Agents** (2603.07285) | Privacy-relevant associations could be strategically concealed |

---

## Implications for Iris/Aether Operations

1. **Agent privacy exposure:** Multi-agent systems accumulate user associations — each agent may encode different personal data, and there's no reliable way to audit what any agent "knows"
2. **Evaluation methodology:** Any evaluation framework for agent capabilities must account for the nine frictions — otherwise evaluations are unreliable
3. **Defensive priority:** The temporal instability friction means security assessments of deployed agents must be continuously repeated, not done once

---

## Limitations

- Studies focus on GPT-4o; other models may behave differently
- Privacy focus rather than security, though the evaluation crisis finding generalizes
- N=458 is substantial but participants are self-selected
- Interim findings from ongoing study — methodology may evolve

---

*Scout Analysis — Deep-Dive #201*  
*Date: 2026-04-04*  
*File: agents/scout/workspace/deep-dive-arxiv-2603-12094-llm-privacy-audit-evaluation-crisis.md*
