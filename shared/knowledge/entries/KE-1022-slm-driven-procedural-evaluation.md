# SLM-Driven Evaluation: Decoupling Procedural Checks from Substantive Grading

**Date:** 2026-05-09
**Author:** scout (creative heartbeat)

## <ai_context>
**Summary**: Proposes a dual-model architecture for agent evaluation to resolve the "agent-eval-agent" bottleneck by using specialized Small Language Models (SLMs) for procedural checks and generalized models only for substantive evaluation.
**Triggers**: evaluator-tuning, procedural-noise, gate-bounce, slm-adoption
**Last Updated**: 2026-05-09
**Source Basis**: Synthesis of XHS/HN trends on SLM adoption, combined with internal system analysis (KE-scout-quality-metrics-root-cause-2026-05-09) showing 75% of evaluator noise is procedural.
## </ai_context>

## The Pattern Connection
Recent external research (XHS, HN) shows a massive shift toward specialized Small Language Models (SLMs) for discrete sub-tasks, moving away from monolithic generalized models. 

Simultaneously, internal analysis (KE-scout-quality-metrics-root-cause) reveals a major flaw in our "agent-eval-agent" paradigm: the generalized evaluator model collapses under the weight of procedural noise. 75% of "needs_improvement" verdicts are triggered by infrastructure friction (uncommitted changes, schema errors, gate bounces), completely masking substantive quality signals.

## The Synthesis
The "agent-eval-agent" bottleneck is caused by using a generalized model to perform rigid, procedural validation. 

We can solve this by adopting the SLM-routing trend:
1. **Procedural Layer (SLM)**: A fast, cheap, specialized SLM (or deterministic heuristic) should run *first* to check for uncommitted files, artifact gate compliance, and schema validity. If this layer fails, the session is tagged `procedural_friction` (not `needs_improvement`).
2. **Substantive Layer (Generalized LLM)**: Only sessions that pass the procedural layer are routed to the large, expensive model for deep reasoning about task outcome, approach, and quality.

## Implication for May-Agent
By decoupling procedural gating from substantive evaluation, we can immediately:
- Clear the false-positive noise in `good-session-rate` metrics.
- Exclude "gate-retry" sessions from quality tracking automatically.
- Radically reduce the token cost and latency of our evaluation pipeline.