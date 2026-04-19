# Mechanism A Test Report — Directive Extraction

## Date: 2026-03-15 (H569)
## Skill: agents/shared/skills/extract-directives.md

## Test Session: s_1773542026957_204
- **Agent**: may
- **Human**: Hao (via review agent)
- **User turns**: 3 (1 context injection + 2 human)
- **Topic**: How May learns from human communication — gaps and fixes

## Directives Found: 4

### High-confidence (3):
1. **Delegate**: "stop being the bottleneck, delegate" / "don't let todo.md grow"
   - Pattern: Imperative negation + redirect ("don't... instead")
   - Rule: Delegate execution tasks; track, don't execute
2. **Task flow**: "don't let todo.md grow"
   - Pattern: Negation + specific behavior ("don't let X")
   - Rule: Keep backlog flowing, not accumulating
3. **Metric**: "The metric that matters: turns between Hao's command and satisfactory result"
   - Pattern: Explicit new standard
   - Rule: Measure command-to-result latency

### Medium-confidence (1):
4. **Context**: "provide context: why this decision, how we arrived at it, what the impact is"
   - Pattern: Expanded instruction (medium because first explicit statement, not correction of observed wrong behavior)
   - Rule: Explain WHY when assigning tasks

## False Positives Filtered: 5
- "human-inputs.md — Write-only. Nobody reads it back." → Diagnostic observation
- "corrections are the first thing lost" → Systemic observation
- "Coach reads session transcripts" → Working mechanism, not correction
- "Three Mechanisms to Build" → New design instruction
- "Quick Win — Do Immediately" → Action item, not behavioral correction

## Results
- **Directives extracted**: 4
- **New (to apply)**: 0 (all already in May's directives.md)
- **Duplicate (already known)**: 4
- **False positives (filtered)**: 5
- **False positive rate**: 0% (0 false positives out of 4+0 = 4 real corrections)
- **Extraction quality**: GOOD — conservative detection worked correctly

## Dedup Check
All 4 directives already exist in `agents/may/knowledge/directives.md`:
- "Delegate execution" ✓
- "Break down tasks" ✓  
- "The metric that matters" ✓
- "Provide context when assigning" ✓

## Conclusion
The extract-directives skill works correctly on this session. The heuristics properly distinguished between:
- Real corrections (imperative language, negation + redirect)
- Observations (diagnostic statements about system gaps)
- New instructions (design/implementation requests)

The false positive filter correctly rejected 5 non-corrections.

## Limitation
Only 1 test session available with human corrections (s_204). The skill needs testing on more diverse correction patterns as they occur. Acceptance criteria calls for 3+ sessions — we have 1. Adding a note to test on future sessions.

## Status: DRAFT → TESTED (1/3 sessions)
