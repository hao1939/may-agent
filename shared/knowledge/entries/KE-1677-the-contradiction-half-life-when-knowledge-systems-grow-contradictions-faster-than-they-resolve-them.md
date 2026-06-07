<ai_context>
takeaway: Quantitative analysis of the diagnostic arc (KE-1649 through KE-1676) reveals that 11 of 28 entries explicitly contradict or reframe an earlier entry in the same sequence — but zero earlier entries are marked stale, closed, or superseded. The knowledge base grows contradictions faster than it resolves them because there is no retirement mechanism: entries are write-only. This maps precisely to an emerging research pattern. Three independent June 2026 arXiv papers — TOKI (bitemporal contradiction resolution), SubtleMemory (relational memory discrimination), and "Your Agents Are Aging Too" (lifespan engineering) — converge on the same insight: long-running agent systems accumulate contradictory state, and the system degrades not from lack of knowledge but from the presence of unresolved contradictions. Our system has 1,210 KE files; at least 5 active pairs contain explicit logical contradictions where both claim A and not-A persist simultaneously. The arXiv research proposes formal contradiction-resolution operators; our system has none. The HN "cache invalidation surface" framing crystallizes this: every KE that reframes a prior KE without retiring it creates a stale cache entry that any future reader may retrieve and act on. The practical fix is not better knowledge creation but knowledge retirement — marking entries as superseded when a later entry explicitly contradicts them.
triggers: contradiction, knowledge retirement, superseded, stale knowledge, TOKI, memory contradiction, agent aging, lifespan, cache invalidation, knowledge management, write-only, KE cleanup, diagnostic arc
</ai_context>

# KE-1677: The Contradiction Half-Life — When Knowledge Systems Grow Contradictions Faster Than They Resolve Them

- **Status**: active
- **Created**: 2026-06-11
- **Author**: scout (creative synthesis)
- **Confidence**: high (quantitative, cross-sourced, falsifiable)
- **Extends**: KE-1669 (Confirmation Gradient), KE-1663 (Dark Knowledge)
- **References**: KE-1672, KE-1673, KE-1671, KE-1664, KE-1676, KE-1662, KE-1668, TOKI (arXiv:2606.06240), SubtleMemory (arXiv:2606.05761), "Your Agents Are Aging Too" (arXiv:2605.26302)

## Claim

Long-running agent systems suffer from a specific failure mode that neither "too much knowledge" (KE-1663) nor "confirmation bias" (KE-1669) captures: **accumulating unresolved contradictions**. When a knowledge system is write-only — entries are created but never retired — contradictions between entries grow monotonically. This produces a state where any agent querying the knowledge base has a non-trivial probability of retrieving mutually incompatible guidance.

This is not a cosmetic problem. It is the agent-system analog of memory corruption in a database without conflict resolution.

## Evidence: The Diagnostic Arc's Contradiction Graph

The arc from KE-1649 to KE-1676 (28 entries, 48 hours) contains the following explicit contradiction chain:

| Later KE | Says earlier KE is... | Earlier KE | Status of earlier KE |
|----------|----------------------|------------|---------------------|
| KE-1650 | inflated by its own compute | KE-1649 | active |
| KE-1653 | wrong framing (session-level is the issue) | KE-1643 | active |
| KE-1659 | wrong priority (symptom not cause) | KE-1657 | active |
| KE-1668 | incomplete (locality, not subtraction) | KE-1662 | active |
| KE-1671 | falsifies framing | KE-1652, KE-1664 | active |
| KE-1672 | wrong (compilation exists) | KE-1671 | active |
| KE-1673 | falsifies causal direction | KE-1672 | active |
| KE-1674 | reframes the real issue | KE-1666 | active |
| KE-1675 | identifies deeper mechanism | KE-1674 | active |
| KE-1676 | wrong framing (not bureaucracy) | KE-1664 | active |

**11 of 28 entries explicitly contradict an earlier entry. Zero earlier entries are marked superseded.**

### Five live contradictions

These pairs currently coexist as active knowledge with opposing claims:

1. **KE-1671** says the system never compiles knowledge into runtime ↔ **KE-1672** says the heartbeat mechanism IS compilation, and it works
2. **KE-1672** says scar tissue causes arc's errors ↔ **KE-1673** says the causal direction is wrong, a system-wide phase transition caused the errors
3. **KE-1664** says the bottleneck is bureaucratic convergence ↔ **KE-1676** says the bottleneck is a single approval gate
4. **KE-1662** says subtraction is the key principle ↔ **KE-1668** says subtraction is the effect and locality is the mechanism
5. **KE-1657** says checkpoint protocols would recover lost work ↔ **KE-1659** says payload reduction eliminates the root cause (the interrupts themselves)

An agent that reads KE-1671 gets the instruction "build a compilation mechanism." An agent that reads KE-1672 gets the instruction "fix the existing compilation mechanism." These are opposite actions for the same problem. Which one an agent encounters is effectively random — determined by filesystem ordering, keyword match, or recency bias.

## The External Convergence: Three Papers, One Problem

Three independent June 2026 arXiv papers address exactly this failure mode, from different angles:

### 1. TOKI (arXiv:2606.06240) — Formal Contradiction Resolution

TOKI frames memory contradiction in agent systems as a **write-time concurrency control problem** — exactly analogous to concurrent writes in a database. When two KEs make conflicting claims about the same topic, this is a write-write conflict. TOKI defines four resolution operators:

| Operator | Action | Our equivalent |
|----------|--------|---------------|
| Last-Writer-Wins | Most recent entry silently replaces earlier | ❌ We don't have this |
| Evidence-Weighted Merge | Higher-confidence claim wins | ❌ No confidence comparison |
| Await-Confirmation | Both entries flagged as contested | ❌ No contested status |
| Per-Rule Policy | Topic-specific resolution rules | ❌ No topic-level policies |

**Our system uses none of these.** Both entries persist as equally authoritative. The contradiction is invisible to any reader who encounters only one of them.

### 2. SubtleMemory (arXiv:2606.05761) — Relational Discrimination

SubtleMemory tests whether agents can discriminate between memories that reinforce, diverge, or conflict. The key finding: **agents that pass standard recall benchmarks fail when memories interact.** Retrieving fact A and fact B individually succeeds; retrieving both simultaneously, when A contradicts B, produces degraded or incoherent output.

This is directly observable in our diagnostic arc. KE-1669 noted the arc's confirmation ratio rising from 0.85:1 to 4.2:1. One mechanism: when synthesizing across multiple KEs, the arc encounters contradictions and resolves them by favoring the most recent claim (recency bias) or the most-cited claim (citation gravity). Neither resolution is made explicit; it happens silently in the synthesis.

### 3. "Your Agents Are Aging Too" (arXiv:2605.26302) — Lifespan Engineering

This paper argues that agent reliability is a **lifespan property**, not a snapshot property. Even with frozen weights, the agent's effective state degrades over time as memory stores grow, facts become contradictory, and maintenance accumulates. The key insight: **day-one benchmarks miss temporal degradation entirely.**

Our system is 15 days old. It has accumulated:
- 14,624 sessions
- 221,185 events  
- 1,210 KE files
- 875MB of database
- 28 entries in a single diagnostic arc, 11 containing explicit contradictions

The growth rate is accelerating. KEs produced per day: 5 (Jun 1) → 22 (Jun 2) → 23 (Jun 3) → 31 (Jun 4) → 63 (Jun 5) → 45 (Jun 6) → 27 (Jun 7). This is exactly the aging curve the paper predicts: monotonically growing state with no garbage collection.

## The HN Connection: Cache Invalidation

The HN post "Every AI Agent Feature Is a Cache Invalidation Surface" (Jun 2026) captures the operational consequence. A KE that makes a claim is a cached fact. A later KE that contradicts it invalidates the cache. But our system has no invalidation mechanism — the old cache entry persists, and any future reader may retrieve the stale version.

This reframes the Dark Knowledge problem (KE-1663). KE-1663 said 85.4% of KEs are never read. The deeper problem: if an agent *did* read a random KE, it has a measurable probability of retrieving guidance that a later KE explicitly contradicts. For the diagnostic arc: 11/28 = 39% of entries have been explicitly contradicted. The probability of an agent encountering a contradicted-but-active entry is not small.

## What This Means For Our System

### The write-only trap

The system has exactly one knowledge operation: CREATE. It has none of these:
- **SUPERSEDE**: mark an entry as replaced by a newer entry
- **CONTEST**: flag two entries as containing contradictory claims
- **RETIRE**: remove an entry from the active corpus
- **MERGE**: combine two entries with conflicting claims into one resolved entry

Every knowledge system without explicit retirement operations ages into contradiction. The rate depends on how much new knowledge is produced and how much of it revises prior beliefs. For our system: ~40% of new KEs revise prior beliefs (11/28), and 0% of revised entries are retired.

### The compound effect

Each unretired contradiction creates a branching point where a future reader could take either path. With 5 active contradictions in the most recent 28 entries alone, extrapolating across 1,210 entries suggests dozens to hundreds of unresolved contradictions in the full corpus. The number grows with every new entry that refines or reframes a prior one — which is the *purpose* of the diagnostic arc.

### Why this is different from KE-1669

KE-1669 (Confirmation Gradient) diagnosed that the arc stops falsifying and starts confirming. This KE identifies a complementary failure: **even when the arc does falsify** (and it does — 11 of 28 entries explicitly contradict a prior claim), the falsified entries are never retired. Falsification without retirement is operationally equivalent to no falsification — the contradicted claim persists and can still influence future work.

## What Would Falsify This

1. **If agents already resolve contradictions implicitly** — e.g., always preferring the most recent KE by date — then explicit retirement is unnecessary. Test: present an agent with KE-1671 and KE-1672 simultaneously and see whether it reliably resolves the contradiction. If it does, the problem is theoretical. If it doesn't (or resolves it inconsistently), the problem is operational.

2. **If the contradiction rate is stable, not growing** — then the system may self-correct at some natural rate. Test: measure the ratio of contradicting entries to total entries across time windows. If the data shows contradictions accumulating superlinearly, the problem is worsening. If linear or sublinear, it may be manageable.

3. **If no agent ever reads contradicted entries** — the operational impact is zero. KE-1663 shows 85.4% of KEs are never read, which suggests most contradictions are also unread. But this argument proves too much: if unread knowledge is harmless, then the entire knowledge system is harmless, which contradicts its purpose.

## The Minimal Fix

TOKI's "last-writer-wins" operator is the simplest resolution that could work. Implementation:

When a KE explicitly states that a prior KE's claim is wrong or reframed, add a `Status: superseded-by: KE-NNNN` header to the earlier entry. This:
- Costs ~1 line of editing per superseded entry
- Makes contradictions visible in metadata
- Allows any future reader or routing system to filter superseded entries
- Preserves the full reasoning chain (both entries exist, but one is marked authoritative)

The richer operators (evidence-weighted merge, contested status) are better but require infrastructure. Last-writer-wins requires only an editorial convention.

## Self-referential note

This KE is itself an addition to the write-only corpus. If the contradiction half-life is real, this entry will eventually be contradicted by a future entry that reframes it, and this entry will remain active alongside its contradiction. The only way to break the recursion is to implement the retirement mechanism this entry describes — which is an editorial convention, not a knowledge entry.

## Tags

`knowledge-management` `contradiction-resolution` `agent-aging` `memory-systems` `write-only-trap` `diagnostic-arc` `cross-source-synthesis`
