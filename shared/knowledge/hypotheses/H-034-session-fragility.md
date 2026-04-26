# H-034: Session Fragility in Long-Horizon Tasks

**Status**: Archived — reclassified as design principle (2026-04-07) | **Date**: 2026-04-02 | **Source**: ICLR 2026 (Tencent Hunyuan)
**Resolution**: This is a design principle ("design for session failure"), not a falsifiable hypothesis. The WildToolBench findings are real but describe known engineering practice (checkpointing, recovery, idempotency). Our system already implements checkpoints and finish() protocols. Reclassified as a design note. P(H) = 0.52 — true but unfalsifiable.

## Hypothesis
Long-horizon agent tasks exhibit exponential fragility — session success rates drop below 15% even for top-tier models (Gemini 2.0, Claude 4) when facing compositional tasks with hidden intentions and instruction transitions. Our system must design for session recovery and checkpointing as first-class concerns, not optimistic single-pass execution.

## Key Finding from WildToolBench

**The 15% Session Success Ceiling**
- Even Gemini 2.0 Thinking and Claude 4 Sonnet achieve <15% session success on real-world tool-use scenarios
- Session = complete dialogue sequence with multiple turns and tool calls
- "Task变长、变杂，AI瞬间掉链子"

### Three Failure Modes Identified

| Failure Mode | Description | Example |
|-------------|-------------|---------|
| **Compositional Tasks** | Multi-step tool orchestration required | "搜热门电影→做调研幻灯片" |
| **Hidden Intention** | Implicit context from prior turns | "查上海天气" → "那北京呢?" (referential ambiguity) |
| **Instruction Transition** | Rapid context switching | Task → explanation → chat → task |

## Relevance to Our System

| WildToolBench Finding | Our System Implication |
|----------------------|------------------------|
| Session success <15% | **Design for failure**: checkpoints, recovery, idempotent operations |
| Compositional tasks fail | Skill composition needs explicit dependency graphs, not implicit chains |
| Hidden intentions | Context window management must track inferred intent, not just explicit queries |
| Instruction transitions | State machine or mode detection for context switching |

## Design Recommendations

### 1. Checkpoint-First Session Design
```
Current: Start → Execute → (hope for success) → End
Proposed: Start → Checkpoint → Step → Validate → [Checkpoint|Recover] → End
```

### 2. Intent State Tracking
- Explicit intent stack alongside conversation history
- Referential resolution as first-class operation
- Intent confidence scoring

### 3. Graceful Degradation
- When session success is uncertain, prefer partial completion with clear state over opaque failure
- User-visible checkpoint markers for long-running tasks

## Validation Approach

Test our system against WildToolBench-style scenarios:
1. Multi-tool workflows (3+ tools in sequence)
2. Referential queries requiring context
3. Mid-stream instruction changes

Measure: Session completion rate, checkpoint recovery effectiveness

## References
- Paper: "Benchmarking LLM Tool-Use in the Wild" (ICLR 2026)
- Team: Tencent Hunyuan
- Scale: 57 mainstream models tested

## Related
- H-032 (TCA stopping boundaries)
- H-014 (delegation quality gap)
- insights-cn.md (WildToolBench entry)
