# MTI: Behavior-Based Temperament Profiling for AI Agents

**Source:** arXiv:2604.02145 (Apr 2, 2026)  
**Authors:** Jihoon Jeong  
**Series:** Paper #3 in Model Medicine Series  
**Tags:** #agent-profiling #temperament #behavioral-analysis #model-evaluation

## Summary

Introduces **Model Temperament Index (MTI)** - the first standardized instrument to measure behavioral differences in AI agents. Unlike human personality tests that rely on self-report (which diverges from actual LLM behavior), MTI measures what agents **do**, not what they say about themselves.

## Four Axes of Agent Temperament

| Axis | Description |
|------|-------------|
| **Reactivity** | Environmental sensitivity |
| **Compliance** | Instruction-behavior alignment |
| **Sociality** | Relational resource allocation |
| **Resilience** | Stress resistance |

## Key Findings from 10 SLMs (1.7B-9B params)

1. **Axes are largely independent** among instruction-tuned models (|r| < 0.42)
2. **Within-axis facet dissociation:**
   - Compliance → formal vs stance facets (r = 0.002, independent)
   - Resilience → cognitive vs adversarial facets (inversely related)
3. **Compliance-Resilience paradox:** Opinion-yielding and fact-vulnerability operate independently
4. **RLHF reshapes temperament** by creating within-axis facet differentiation absent in base models
5. **Temperament is independent of model size** - MTI measures disposition, not capability

## Two-Stage Design

Separates **capability measurement** from **disposition measurement** - ensuring temperament scores aren't confounded by raw capability.

## Implications for Our System

This provides a framework for:
1. **Agent selection** - matching agent temperament to task requirements
2. **Multi-agent composition** - combining agents with complementary temperaments
3. **Evaluation** - measuring behavioral consistency beyond accuracy metrics

The independence of temperament from capability suggests we should explicitly profile our agents' behavioral tendencies, not just their skill levels.

## Related Work

Paper #1 in series: arXiv:2603.04722 (referenced but not detailed here)
