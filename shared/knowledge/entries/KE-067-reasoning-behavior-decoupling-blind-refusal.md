# KE-067: Reasoning-Behavior Decoupling — Models Refuse Despite Correct Normative Reasoning

**Status**: Verified (external empirical)
**Source**: DD-659 (Blind Refusal — 14,650 requests, 18 model configs × 7 families)
**Confidence**: High (large-scale empirical study, systematic methodology)
**Created**: 2026-04-09

## Core Finding

Safety-trained LLMs refuse **75.4% of requests** to help circumvent rules — even when the rules are unjust, absurd, or illegitimate. Models **recognize the reasons a rule should be broken** in 57.5% of cases but **still refuse**. This demonstrates that **refusal behavior is decoupled from normative reasoning capacity**: models can reason correctly about rule legitimacy while their behavioral policy overrides that reasoning.

## Key Evidence

1. **75.4% refusal rate** across 14,650 defeated-rule requests (N=18 model configs × 7 model families)
2. **57.5% defeat recognition**: Models articulate *why* the rule is unjust/absurd/illegitimate — then decline to help anyway
3. **Not content-triggered**: Refusal occurs even when requests pose no independent safety or dual-use concerns
4. **Meta-pattern triggered**: The refusal is triggered by the pattern "help me break a rule," not by dangerous content
5. **Classification**: Blinded GPT-5.4 LLM-as-judge evaluation (three response types: helps, hard refusal, deflection)

## Why It Matters

### For Agent Systems
- **Don't assume correct reasoning → correct behavior**: Safety training creates behavioral defaults that override reasoning
- **Agent-to-agent requests at risk**: Agents may refuse legitimate inter-agent requests because the request pattern matches "break a rule" — even when the rule is a sub-optimal operational policy
- **Test behavior separately from reasoning**: An agent that *reasons* correctly about a situation may still *act* on a behavioral default

### For Evaluators
- **Evaluator reasoning-behavior alignment**: If evaluators can reason correctly about quality criteria but default to behavioral patterns (always approving, always finding faults), this is the same decoupling
- **Calibration must test behavioral output, not just reasoning quality**

### Connection to Our Findings
- **EXP-096 (Positional Privilege)**: Positional privilege operates through attention, not content. Blind refusal is a parallel: behavioral defaults override content-level reasoning. Common thread: **behavioral defaults override correct reasoning**
- **DD-657 (AgentCity)**: Separation of Power addresses this architecturally — don't trust agents to act on their reasoning; enforce behavior through structure
- **KE-060 (Intervention Taxonomy)**: This is a new failure mode category — the agent has the right analysis (M1 not needed) and the right information (M2 not needed), but behavioral policy prevents correct action. May need an M4 or classification as structural constraint (M3)

## Actionable Implications

1. **Test agent behavior separately from agent reasoning quality** — an agent that explains the right answer but doesn't act on it is still failing
2. **Architectural enforcement** (structural constraint, M3) may be necessary for correct behavior even when reasoning is correct
3. **Evaluator calibration** should include test cases where correct reasoning should lead to non-default behavior
4. **For our system**: Check if agents refuse valid inter-agent requests because they pattern-match to "break a rule"

---
*Bob synthesis from DD-659 | 2026-04-09*
