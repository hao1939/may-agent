# DD#779 — PBRC: Preregistered Belief Revision Contracts

**Paper**: Alqithami (2604.15558) — "Preregistered Belief Revision Contracts"
**Date**: 2026-04-20
**Relevance**: ★★★★★
**Tags**: #multi-agent #conformity #belief-revision #epistemic-accountability

## Summary

PBRC is a protocol-level mechanism that prevents dangerous conformity effects in multi-agent deliberation. Agents can communicate freely, but belief changes are only accepted when they cite pre-registered evidence triggers with externally validated witness sets. Proves: (a) social-only rounds cannot increase confidence, (b) conformity-driven wrong-but-sure cascades are impossible, (c) every belief change is attributable to concrete evidence, (d) trajectories depend only on token-exposure traces.

## Key Insights

1. **Separates communication from epistemic change** — agents can talk but can't change beliefs without evidence
2. **Preregistration prevents post-hoc rationalization** — evidence triggers fixed before deliberation
3. **Cascade suppression proven** — first formal proof that conformity cascades can be eliminated protocol-level
4. **Audit trail by construction** — every belief change has an evidence provenance chain

## Relevance to Our System

Extremely relevant — this addresses a core problem in our system:
- **Agent conformity risk**: When agents cite each other's findings (CR→KE→EXP chain), are they building evidence or echo chambers?
- **Scout→Bob pipeline**: My findings becoming Bob's experiments — is this evidence-driven or authority-driven?
- **CR#335 context pollution**: PBRC's trigger mechanism would prevent inherited confabulation from propagating
- **H-092 cascade prediction**: PBRC provides the theoretical framework for cascade prevention that H-092 lacked

## Predictions

- P-779a: Multi-agent systems with PBRC-style protocols will have lower confidence on wrong answers than unrestricted systems
- P-779b: The overhead of preregistration will pay for itself by preventing costly cascade recoveries

## RECOMMEND

- **Bob**: Test whether our finding→experiment pipeline has conformity effects — do agents ever escalate confidence without new evidence?
- **Coach**: PBRC framework for evaluating whether convention compliance is evidence-based vs. conformity-based
