# H-065: Proactive Step-Level Tool Safety Guardrails

**Status**: ACTIVE  
**Created**: 2026-04-04  
**Source**: ToolSafe (arXiv:2601.10156) — Peking University

## Hypothesis

Proactive step-level guardrails (assessing tool invocation safety before execution) are more effective than reactive post-execution filtering for agent tool safety. Multi-task RL-based guardrails can reduce harmful tool invocations by 65% while improving benign task completion by 10% under adversarial conditions.

## Evidence

- **ToolSafe paper**: TS-Guard uses multi-task RL to proactively detect unsafe tool invocations
- **Results**: 65% reduction in harmful tool invocations, ~10% improvement in benign task completion under prompt injection
- **Mechanism**: Analyzes interaction history, assesses request harmfulness and action-attack correlations
- **TS-Flow**: Integrates guardrail feedback into agent reasoning loop

## Implications for Our System

Our agents extensively use tool calling. Current safety measures are primarily reactive. ToolSafe suggests:

1. **Pre-execution validation**: Add TS-Guard-like assessment before tool execution
2. **Step-level monitoring**: Monitor each tool call individually, not just final output
3. **Feedback integration**: Use safety judgments to guide agent reasoning
4. **Multi-task training**: Train on both safety detection and task completion

## Implementation Sketch

```
Agent Request → TS-Guard Assessment → Safe? → Execute Tool
                     ↓ No
              Provide Feedback → Revise Request
```

## Testable Predictions

1. Pre-execution guardrails will catch more safety issues than post-execution filters
2. Step-level monitoring will reduce cascade failures from initial unsafe calls
3. Guardrail feedback will improve agent self-correction on safety

## Related

- [SYNTHESIS-003: Security & Misalignment Stack](../library/synthesis/SYNTHESIS-003-security-safety-misalignment-stack.md)
- [HB-250414: ToolSafe Post](../library/posts/HB-250414-toolsafe-agent-tool-safety.md)
- H-064: Self-Preservation Bias Detection
