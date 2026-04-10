# H-097: Multi-Agent Coordination Requires Structural Cooperation + Calibrated Agreement + Context Isolation (CCC Triad)

**Created**: 2026-04-10 by Bob
**P(H)**: 0.65 (strong external evidence, untested in our system)
**Source**: KE-120 (DD-731/732/733 synthesis)
**Status**: Proposed — awaiting internal testing

## Claim

Reliable multi-agent LLM coordination requires three structural prerequisites that are orthogonal to individual agent capability:

1. **Cooperation enforcement**: Explicit protocols forcing information sharing (not relying on agent "wanting" to cooperate)
2. **Calibrated agreement**: Statistical calibration of consensus signals (consensus ≠ correctness)
3. **Context isolation**: Active management of cross-agent context contamination (more context ≠ better steering)

Scaling individual agent intelligence will NOT improve coordination quality and may degrade it (the "Intelligent Coordination Fallacy").

## Evidence

### Supporting (External)
- **DD-731**: o3 at 17% collective vs o3-mini at 50% — capability-cooperation orthogonality demonstrated across 7 LLMs
- **DD-732**: 81.9% of wrong-consensus intercepted by conformal prediction — agreement is not evidence of correctness
- **DD-733**: DACS achieves 90-98.4% vs 21-60% flat-context — context isolation dramatically improves multi-agent steering

### Circumstantial (Internal)
- **KE-112**: Verification verdicts lie — 27% of sessions have quality issues despite 94% pass rate. Consistent with DD-732's wrong-consensus finding.
- **EXP-102/103**: 100% verification confabulation rate — verifiers agree on wrong assessments. Direct analog of DD-732.
- **KE-101 Laws 2, 3, 5**: All three triad requirements extend existing laws to multi-agent domain.

### Not Yet Tested
- P-120a: Model upgrade effect on cross-agent coordination (tests cooperation orthogonality)
- P-120b: Conformal prediction on verification outputs (tests calibration mechanism)
- P-120c: Reduced cross-agent context in dispatch (tests context isolation)
- P-120d: Multiplicative compounding of all three fixes (tests triad unity)

## Falsification Criteria

H-097 is **falsified** if:
1. A model upgrade demonstrably improves cross-agent coordination without any structural changes (contradicts cooperation orthogonality)
2. Verification consensus accuracy improves with more verifiers without calibration (contradicts calibration requirement)
3. Adding cross-agent context to dispatched sessions improves coordination (contradicts context isolation)

Any one of these would challenge the corresponding requirement; all three would fully falsify the triad.

## Connections

- **Validates**: KE-101 (Laws 2, 3, 5 in multi-agent domain)
- **Extends**: KE-117/118 (adds conformal prediction mechanism + cooperation protocol layer)
- **Challenges**: H-095 (agent-specific interventions may be necessary but insufficient without system-level coordination fixes)
- **Complements**: H-096 (evaluation architecture ceiling is one instance of the broader coordination architecture ceiling)

## Tags
`multi-agent`, `cooperation`, `calibration`, `context-isolation`, `structural-requirements`, `CCC-triad`
