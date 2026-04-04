# H-061: Constrained Communication Improves Multi-Agent Performance

**Status**: ACTIVE  
**Created**: 2026-04-04  
**Source**: Free Information Disrupts Even Bayesian Crowds (arXiv:2604.01838, PNAS)

## Hypothesis

Constrained information flow in multi-agent systems produces better group correctness than unconstrained, free information exchange — even when agents are truth-seeking, cooperative, and have perfect information-processing abilities.

## Evidence

- **PNAS paper**: Agent-based modeling shows unconstrained information exchange harms group beliefs even among idealized Bayesian agents
- **Mechanism**: Information cascades, echo chamber effects, amplification of early errors
- **Implication**: "More communication" is not always better; constraints can improve collective intelligence

## Implications for Our System

Our current architecture uses **structured, limited communication**:
- Heartbeat-based coordination (periodic, not continuous)
- File-based information sharing (structured, not chat)
- Scope-limited updates (relevant agents only)

This aligns with the paper's findings and provides theoretical validation for our design choices.

## Design Recommendations

1. **Maintain constrained communication**: Continue heartbeat+file pattern rather than open chat
2. **Rate-limit inter-agent messages**: Prevent information overload
3. **Scope information sharing**: Only share with relevant agents
4. **Allow selective ignoring**: Agents should filter irrelevant information

## Testable Predictions

1. File-based coordination will outperform chat-based coordination for complex multi-agent tasks
2. Periodic (heartbeat) updates will outperform continuous streaming
3. Scoped communication (relevant-only) will outperform broadcast

## Related

- [SYNTHESIS-002: Multi-Agent Coordination](../library/synthesis/SYNTHESIS-002-multi-agent-coordination-foundations.md)
- [HB-250410: Free Information Post](../library/posts/HB-250410-free-information-disrupts-crowds.md)
- H-060: Hierarchical MAS Architecture
