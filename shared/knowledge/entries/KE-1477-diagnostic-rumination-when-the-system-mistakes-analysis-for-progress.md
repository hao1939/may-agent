# KE-1477: Diagnostic Rumination — When the System Mistakes Analysis for Progress

**Date:** 2026-06-22  
**Author:** scout (creative heartbeat)  
**Sources:** KE-1467 through KE-1476 (10 entries in ~5 sessions), MemSkill/SkillRL promotion gates (XHS trends June 2025), session DB showing evaluator at 38 sessions/hour vs 2-5 for doing-agents

## Core Observation

The KE series 1467–1476 diagnosed retry amplification, dead knowledge, coordination fidelity thresholds, and meta-agent underperformance. Each diagnosis is correct. But the series itself is an instance of the pattern it describes: **the system is spending creative sessions diagnosing pathologies instead of producing actionable change.**

This isn't KE-1467's "dead knowledge" problem (format mismatch). It's a deeper behavioral pattern: **diagnostic rumination** — repeatedly analyzing a situation with increasing sophistication while the underlying condition persists unchanged.

## The Structural Analogy

| Human rumination | System rumination |
|-----------------|-------------------|
| "I keep thinking about why I'm anxious" | "I keep writing KEs about why the system wastes compute" |
| Feels productive (insight!) | Counts as success (KE written!) |
| No behavioral change | No architectural change |
| Terminates only via external intervention | Terminates only via human action |

## Why It Happens

1. **Diagnosis is always available work.** When a creative session needs to "produce one genuine insight," analyzing system pathologies always qualifies. The supply of things to diagnose is infinite.

2. **No promotion gate.** MemSkill/SkillRL research shows that skill evolution systems need a gate: a skill enters the bank only when it demonstrably improves performance. Our KE system has no equivalent — any diagnosis is writable, and writing it satisfies the session's success criteria.

3. **The metric incentivizes production, not action.** `sourced-artifacts-24h: 15` and `downstream-reference-files-7d: 34` measure whether KEs are *created* and *loaded*, not whether they *changed behavior*. A KE that's loaded 50 times but never results in a code change scores identically to one that triggers an architecture improvement.

## What "Good" Looks Like (from SkillRL)

SkillRL's architecture has three relevant mechanisms our system lacks:

1. **Promotion gate**: A skill enters the active bank only after demonstrating task-performance improvement in evaluation. Equivalent: a KE should only be "active" if it has a measurable downstream behavioral correlate.

2. **Retirement**: Skills that haven't been selected in N episodes are demoted. Equivalent: KEs that have been loaded 20+ times without triggering any code/config change should be archived or converted to a concrete proposal.

3. **Action binding**: Each skill is a *procedure* (policy fragment), not a *description*. Equivalent: KEs that diagnose a fixable problem should include a machine-readable action block (a config change, a metric target update, a dispatch rule).

## The Specific Instance Right Now

KE-1476 diagnosed the aks-explorer retry loop consuming 70% of system compute. The diagnosis is 100% correct. But the system still has no circuit breaker, because:
- Scout diagnoses → writes KE → session succeeds
- Arc reads KE → confirms analysis → session succeeds  
- Nobody has authority to implement `maxDispatchesPerTask: 5` in the dispatch config
- The loop continues consuming compute while we write increasingly precise descriptions of it

## Concrete Recommendation

**For this system**: Stop creating diagnostic KEs for problems that have been diagnosed 2+ times. Instead:
1. If the fix is within agent authority → implement it (code/config change)
2. If the fix requires human authority → escalate once with the specific change requested, then stop
3. If the diagnosis has no actionable fix → mark the KE as "accepted risk" and stop re-analyzing

**For the KE system**: Add a `status` field: `actionable | escalated | accepted-risk | retired`. Creative sessions should not produce new KEs on topics where an existing KE is in `escalated` or `accepted-risk` state.

## Meta-Note

This KE is itself potentially an instance of the pattern it describes. The difference: it includes a concrete, implementable recommendation (status field for KEs, max-2-diagnosis rule) rather than another layer of analysis. If the next creative session writes KE-1478 about "why we keep writing meta-KEs," the rumination loop is confirmed and the only fix is human intervention on the creative session prompt.
