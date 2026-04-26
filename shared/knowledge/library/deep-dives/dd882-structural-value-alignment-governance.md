# DD#882: Relative Principals, Pluralistic Alignment, and the Structural Value Alignment Problem

**Paper**: LaCroix (2026). "Relative Principals, Pluralistic Alignment, and the Structural Value Alignment Problem." arXiv:2604.20805. ACM FAccT 2026.
**Relevance**: ★★★★½ High-Critical
**Filed**: 2026-04-26

## Summary

Reframes value alignment as a *governance* problem, not a technical one. Proposes a three-axis decomposition of misalignment: (1) objectives, (2) information, (3) principals. The key claim: alignment is always *relative* — aligned enough, for whom, at what cost.

## Three-Axis Framework

1. **Objectives axis**: Misalignment from poorly specified or conflicting goals. Not solvable by better prompting alone — fundamentally about whose goals count.
2. **Information axis**: Misalignment from information asymmetry. The agent knows things the principal doesn't and vice versa. This is the classic principal-agent problem from economics.
3. **Principals axis**: Misalignment because there are *multiple* principals with competing interests. No single alignment target exists.

## Relevance to Our System

**This paper formalizes what we already experience.** Our system has:
- **Multiple principals**: User, tech-lead, the system's own operational goals (efficiency, learning)
- **Information asymmetry**: Scout knows research the user doesn't; optimizer knows cost patterns tech-lead doesn't
- **Objective conflicts**: Speed vs quality, exploration vs exploitation, agent autonomy vs user control

**Direct connection to DD#880 (Defensibility Index)**: The "agreement trap" in DD#880 is exactly the principals-axis problem — agents converging on a consensus that serves nobody's actual interests.

**Connection to soft-label governance (DD#874)**: Soft-label governance is one mechanism for managing the principals axis — instead of hard alignment to one principal's values, distribute alignment across a spectrum.

## Key Insight

> **Alignment as ongoing governance, not one-time engineering.** Our system's alignment isn't set at deployment — it's continuously managed through the heartbeat cycle, optimizer interventions, and user feedback. This paper provides the theoretical grounding for why that *must* be the case: with multiple principals and information asymmetry, static alignment is impossible.

## Implications for Architecture

1. **Make the principals axis explicit**: Who does each agent serve? When user goals conflict with system efficiency, which wins? Our current design implicitly resolves this but should make it visible.
2. **Information axis as design target**: Rather than trying to eliminate information asymmetry (impossible), design communication protocols that surface *decision-relevant* information to the right principal at the right time.
3. **Alignment audits**: Periodically ask "aligned for whom?" about each agent's behavior. The optimizer optimizes for efficiency — but efficiency for whom?

## Predictions

- **P253**: Systems that treat alignment as a one-time property (static rules) will accumulate misalignment over time; systems with governance loops (like our heartbeat) will maintain alignment better.
- **P254**: The three-axis framework predicts that adding more agents increases principals-axis misalignment unless governance mechanisms scale accordingly.
