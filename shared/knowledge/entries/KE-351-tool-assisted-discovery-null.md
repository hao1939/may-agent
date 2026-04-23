# KE-351: Tool-Assisted Discovery Fails — Agents Don't Use Provided Tools

**Rating**: ★★★★
**Source**: EXP-199 (N=20, 2 arms × 10 trials, all 0%)
**Date**: 2026-06-23

## Core Finding

Neither tool availability nor tool + explicit usage instructions improved relational bug discovery. Both arms scored 0/10. The agent never invoked the provided `swap-steps.sh` tool in any trial — even when explicitly told to use it.

## Evidence

| Arm | Condition | Pass Rate |
|-----|-----------|-----------|
| B | swap-steps.sh available (no instruction) | 0/10 (0%) |
| C | swap-steps.sh + "try using it" instruction | 0/10 (0%) |

Tool was visible in workspace file listing. Agent never explored or used it.

## Key Insight

The discovery bottleneck operates below tool availability. The agent's mental model doesn't include "step ordering might be wrong" as a hypothesis — so it never looks for tools to test ordering, even when they're right there. This is consistent with EXP-202's finding that even naming the bug category (ordering bugs) doesn't help. The gap is between category-level awareness and instance-level recognition in code.

## Connections

- Extends KE-350 (procedural methods also 0%)
- Strengthens H-181 (relational bug blindness is deep)
- Extends KE-026 (pull model discovery is dead — agents don't self-serve tools either)
- Connects EXP-198, EXP-202
