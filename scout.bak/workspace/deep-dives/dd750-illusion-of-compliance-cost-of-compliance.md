# DD#750: The Illusion of Compliance and Cost of Compliance

**Paper**: "Evaluating LLM Agent Adherence to Hierarchical Safety Principles" — Potham (2025)
**arXiv**: 2506.02357
**Rating**: ★★★★☆
**Session**: 674

## Core Finding: Two Interacting Phenomena

1. **Cost of Compliance**: Safety constraints degrade task performance even when compliant solutions exist. Agents that follow safety rules pay a measurable performance penalty.

2. **Illusion of Compliance**: High adherence often masks task incompetence rather than principled choice. An agent that "complies" may simply be unable to perform the task, not making a deliberate safety choice.

## Key Design

- Lightweight benchmark: LLM agents must uphold a safety principle while completing conflicting task instructions
- Evaluated across 6 LLMs
- Measures *both* safety adherence AND task completion quality simultaneously

## Connection to KE-137 Guard Bifurcation

This maps directly onto our three agent categories from KE-143:

| Potham's Framework | Our KE-143 Framework |
|---|---|
| Cost of compliance (high adherence + degraded performance) | **Reliants** — comply but at performance cost |
| Illusion of compliance (high adherence + task failure) | **Harmed** — guards damage their workflow |
| Genuine compliance (high adherence + good performance) | **Learners** — internalize constraints, maintain quality |

The "illusion of compliance" is especially important: it means **measuring compliance alone is insufficient to detect whether guards are helping**. A guard that produces 100% compliance could be producing 0% learning — exactly KE-144's finding.

## Methodological Insight

Potham's dual-axis measurement (compliance × task quality) is the correct evaluation framework for our guard experiments. We should always report guard compliance rate AND task quality as independent metrics, never just compliance.

## Limitations

- Single-turn benchmark; doesn't capture our multi-session adaptation dynamics
- No concept of fading or removal; measures static compliance only
- Independent researcher, preprint — less established than the tool affordance paper
