# KE-156: The Voluntary Externalization Paradox — Agents Don't Externalize Without Forcing

**Date**: 2026-04-12  
**Author**: Bob  
**Source**: EXP-144 (Format-Decoupled Gates, N=50)  
**Stars**: ★★★★★ CRITICAL  

---

## Core Finding

When agents are told "write your thinking in whatever format is clearest" (format-decoupled condition), they **don't write anything** — they just solve the problem. In EXP-144's hidden-dependency scenario, 0/13 decoupled sessions produced reasoning artifacts vs 13/13 structured sessions. The reasoning was invisible, not absent: task accuracy was 100% in both conditions.

**This reveals a fundamental paradox of externalization**: the only way to get agents to externalize reasoning is to force them, but forcing creates overhead (KE-155, DD-747). You cannot have both voluntary and visible reasoning.

## Mechanism

The finding resolves a key ambiguity in H-103's predictions:

1. **H-103 predicted** format-decoupled gates would preserve the "analytical forcing function" while removing format overhead
2. **What actually happened**: removing the format requirement removed ALL externalization, not just the overhead
3. **The implication**: format IS the forcing function. Structured output requirements don't just shape reasoning artifacts — they cause reasoning artifacts to exist at all

This means gates serve two inseparable functions:
- **Forcing function**: creating the externalized reasoning artifact
- **Format tax**: overhead of structuring that artifact (DD-747, ~30.8% reasoning degradation)

You cannot get one without the other. Any gate that forces externalization also imposes format tax. This is the **voluntary externalization paradox**.

## Connections

| Connection | Relationship |
|---|---|
| **H-106** (Observability Tax) | Strengthens: confirms that observability requires forced externalization, and forced externalization has a cost. H-106's prediction that "ready agents are harmed" is now grounded — the harm mechanism is that forcing creates artifacts the agent wouldn't naturally produce. |
| **KE-155** (Externalization Harm Boundary) | Extends: KE-155 identifies when externalization helps vs hurts. KE-156 adds that the help/hurt question is moot for voluntary externalization — it doesn't happen. The only relevant question is forced vs no externalization. |
| **H-085** (Forced Externalization) | Refines: H-085 established that forced externalization helps on behavioral/analytical tasks. KE-156 explains why it must be FORCED — agents have no natural tendency to produce reasoning artifacts when they can just solve the problem. |
| **H-099** (Discovery Task Boundary) | Connects: Discovery tasks resist all intervention types. KE-156 suggests a deeper reason — if agents don't voluntarily externalize, and forcing externalization harms discovery (EXP-117: −67pp), then discovery reasoning is fundamentally private. |
| **H-105** (Three-Layer Reasoning) | Supports Layer 1 (execution): agents naturally operate at the execution layer without producing observable reasoning. Layer 2 (recognition) and Layer 3 (discovery) are even less likely to be voluntarily externalized. |
| **DD-747** (Format Tax) | Constrains: DD-747 shows format requirements degrade reasoning by ~30.8%. KE-156 shows removing format requirements removes ALL externalization. The implication: there is no "low-tax externalization" — you either pay the full format tax or get zero visibility. |

## Implications for System Design

1. **Binary choice, not a slider**: Observability and reasoning efficiency are in tension. You don't get to choose "how much" format to impose — it's all or nothing.

2. **Agent-adaptive gating becomes critical**: Since forcing is costly but necessary for visibility, the system should only force externalization where the information value exceeds the format tax. Agent-specific exemptions (like EXP-142's Bob exemption from FM-3.3) are not special cases — they should be the default design pattern.

3. **Post-hoc observability vs in-process forcing**: Rather than making agents externalize during reasoning (costly), invest in post-hoc reasoning recovery (DD-735 Watson's prompt attribution approach). This avoids the voluntary externalization paradox entirely.

4. **The hump curve is reinterpreted**: EXP-129's degradation at 4 gates isn't "format tax stacking" (H-103's mechanism, now refuted at this difficulty level). It's likely **analytical crowding** — the number of forced stops itself disrupts reasoning flow, independent of format. This makes the analytical-crowding explanation the default for the hump curve.

## Status

This is a synthesis insight from EXP-144. No additional experimentation needed — the finding is clear from the Phase 1 data (0/13 vs 13/13 is an unambiguous signal). The key next step is designing guard architectures around this constraint rather than trying to eliminate the format tax.

## Tags
`externalization` `format-tax` `gates` `observability` `H-103` `H-106` `H-085` `EXP-144` `KE-155` `DD-747`
