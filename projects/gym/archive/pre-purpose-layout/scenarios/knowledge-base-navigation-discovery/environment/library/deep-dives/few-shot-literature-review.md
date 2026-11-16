# Deep Dive: Few-Shot Learning in Agent Behavior Modification

**Date**: 2026-03-30
**Author**: Research Team

## Overview

This review synthesizes findings on using few-shot examples to modify agent behavior, drawing on our experimental results and external literature.

## Key Findings

### Position > Content

Our experiments (RX-031, plus 12 follow-up runs) consistently show that WHERE few-shot examples are placed matters more than WHAT they contain.

| Position | Avg Effectiveness | N |
|----------|-------------------|---|
| Task-level message | 100% | 30+ |
| Injected context (task prefix) | 100% | 12 |
| System prompt (skill file) | 0% | 30+ |

### Why System Prompt Fails

1. **Context window distance**: By the time the agent processes the task, system prompt examples are 4-8K tokens away
2. **Attention competition**: System prompt contains 12+ skills, instructions, and guidelines competing for attention
3. **Frame mismatch**: System prompt sets general rules; task message sets specific approach

### Implications for Skill Design

- Skills that provide KNOWLEDGE (e.g., "this API uses camelCase") work in system prompt
- Skills that require BEHAVIORAL change (e.g., "ls before read") fail in system prompt
- For behavioral skills, consider task-level injection or structural enforcement instead

## Open Questions

1. Is there a system prompt length threshold below which few-shot works?
2. Can "pointer" skills ("see the example above") bridge the position gap?
3. Do newer models have better long-range attention for system prompt content?

## References

- RKE-003: Structural enforcement data
- RKE-015: Position effect data
- RX-031: Sycophancy experiment with SOUL vs workflow
- External: [Various papers on in-context learning position effects]
