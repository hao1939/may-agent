# H-097: Multi-Agent Coordination Requires Structural Cooperation + Calibrated Agreement + Context Isolation (CCC Triad)

**Created**: 2026-04-10 by Bob
**P(H)**: 0.55 (updated 2026-04-12 — P-120b leg rendered moot by EXP-147; prior lowered from 0.65 based on design-phase reassessment)
**Source**: KE-120 (DD-731/732/733 synthesis)
**Status**: Partially tested — P-120b moot (EXP-147 Track A), P-120c pending (Track B)

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
- ~~P-120b: Conformal prediction on verification outputs (tests calibration mechanism)~~ **MOOT** — EXP-147 Track A found baseline wrong-consensus rate of 0.92% (95% CI: 0.73–1.11%), far below the 5% threshold. The heuristic evaluator's 3-way classification (good/acceptable/NI) already provides implicit calibration. Conformal prediction has nothing meaningful to improve.
- P-120c: Reduced cross-agent context in dispatch (tests context isolation) — **Track B ready**, budget reallocated from Track A Phase 2
- P-120d: Multiplicative compounding of all three fixes (tests triad unity)

### EXP-147 Track A Results (2026-04-12)
- **Baseline wrong-consensus rate**: 0.92% (3-way definition, N=15,338 heuristic evaluations)
- **Key insight**: Evaluator already uses calibrated 3-way classification — `acceptable` category (36.4% of sessions) functions as implicit uncertainty flag
- **Quality ≠ Process**: 19.7% of `good`-verdict sessions have 3+ convention failures, but these are process violations not quality errors
- **Decision**: Track A Phase 2 skipped (baseline < 5% threshold), budget reallocated to Track B
- **See**: KE-149 (3-way classifier insight), KE-150 (quality ≠ process compliance)

## CR-336 External Validation Map (2026-04-10): EACH LEG INDEPENDENTLY VALIDATED

**Cross-reference**: CR-336 (External Literature Validation Map for the Three-Mechanism Theory)

CR-336 maps the entire 90+ deep dive literature against Bob's 14-week synthesis. For H-097, each CCC Triad leg has independent external validation:

### Per-Leg Validation
- **Cooperation**: DD-731 (Capability ≠ Cooperation) — o3 at 17% collective vs o3-mini at 50%. Capability-cooperation orthogonality demonstrated across 7 LLMs. **Validates cooperation enforcement requirement.**
- **Calibration**: DD-732 (Conformal Social Choice) — 81.9% of wrong-consensus intercepted by conformal prediction. **Validates calibrated agreement requirement.**
- **Context**: DD-733 (DACS) — Dynamic Attentional Context Scoping achieves 90-98.4% vs 21-60% flat-context. **Validates context isolation requirement.**

### CR-336 Assessment
CR-336 rates H-097 external validation at **MODERATE** confidence overall — each leg is independently validated but the triad as a unified theory is untested. The synthesis finding is notable: no external paper proposes all three as co-required, making the triad framing a novel contribution.

### Open Question (from CR-336 Q2)
CR-336 identifies internal replication of the CCC Triad as a priority open question. DD-732's conformal prediction mechanism is flagged as the most immediately testable component.

**P(H) unchanged at 0.65** — CR-336 is a synthesis of existing evidence, not new evidence.

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
