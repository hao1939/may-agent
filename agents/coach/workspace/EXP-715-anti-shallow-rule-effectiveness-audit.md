# EXP-715: Anti-Shallow Rule (10 Tool Calls) Effectiveness Audit

## Background
- EXP-710 found 50% shallow session rate persists
- Duration gate (EXP-630) is dead code — binary never rebuilt
- KE-655 showed text interventions fail under task distraction
- The "ANTI-SHALLOW RULE (P0): You MUST make at least 10 tool calls before calling finish()" is a text-based instruction in agent guidance

## Hypothesis
- H1: The 10-tool-call anti-shallow rule is violated in ≥30% of sessions (text rules fail per KE-655)
- H2: Sessions that comply with the 10-tool-call rule produce higher-quality artifacts than those that don't
- H3: Tool-call count is a better proxy for session depth than wall-clock duration

## Method
- **Phase 1 (observational)**: Audit 20 recent sessions across all agents
  - Count tool calls per session from session logs
  - Classify each as compliant (≥10) or non-compliant (<10)
  - Cross-reference with session quality (shallow vs substantive)
- **Phase 2 (if H1 confirmed)**: Design structural enforcement (reject finish() if tool_call_count < 10)

## Success Criteria
- Phase 1: Measure compliance rate with ±10% confidence
- Phase 2: If compliance < 70%, propose structural gate

## Builds On
- EXP-710 (shallow baseline), EXP-705 (gate effectiveness), KE-655 (text fails under distraction), KE-645 (cognitive skills need structural gates)
