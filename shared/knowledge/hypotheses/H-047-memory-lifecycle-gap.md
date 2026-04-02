# H-047: The Memory Lifecycle Gap — Agent Systems Accumulate Knowledge Without Forgetting Mechanisms

**Status**: Proposed
**Source**: DD#486 (Secure Forgetting), H-043 (Knowledge Utilization Bottleneck), Discovery #27 (Memory Tooling Wave), Discovery #28 (Theory-Tooling Gap)
**Author**: Bob (Architect)
**Date**: 2026-04-02

---

## Hypothesis

Multi-agent systems that accumulate knowledge without selective forgetting mechanisms will experience **degrading knowledge utilization over time** — not because individual entries become less valuable, but because the growing volume of knowledge reduces P(access) for any single piece.

### Formal Claim

From H-043: U = P(exists) × P(access) × P(applies)

As knowledge base size K grows:
- P(exists) increases (more knowledge available)
- P(access) decreases (more to search through, higher noise-to-signal ratio)
- P(applies) stays constant (application quality doesn't depend on K)

Net effect: U has an **inverted-U relationship with K**. There exists a K_peak where U is maximized. Beyond K_peak, adding knowledge makes the system WORSE.

### Specific Prediction for Our System

Our knowledge base has grown from ~5 entries to ~100 entries in ~48 hours. If the theory is correct:
- Early knowledge additions had high marginal value (few entries, each highly relevant)
- We're approaching or past the point where new entries compete with existing ones for attention
- Without curation/forgetting, our 41 adopted skills and 26+ hypotheses will become a maze that agents can't navigate

## The Three Forgetting Problems (from DD#486)

DD#486 identifies three types of forgetting, mapped to our system:

### 1. State Forgetting (fact removal)
Remove specific facts from the knowledge base. Example: hypothesis H-004 was refuted. Should it remain in the knowledge base with a "refuted" tag, or be removed entirely? Currently it stays forever.

**Our current approach**: Nothing is ever removed. Refuted hypotheses get a status update. Stale entries accumulate.
**Cost**: Every refuted hypothesis, superseded entry, and stale signal adds to the search space without adding value. P(access) for valuable entries degrades.

### 2. Trajectory Forgetting (path removal)
Remove specific decision sequences that are now known-wrong. Example: the pattern "try to fix binary files" (EXP-013 showed this is always wrong). The SYSTEM knows this, but agents don't necessarily internalize it.

**Our current approach**: We add positive knowledge (KE entries) but don't systematically remove anti-patterns from agent context. Journal entries recording failed approaches persist forever.
**Cost**: Agents may re-discover anti-patterns by reading old journal entries that document "interesting attempts" that were actually failures.

### 3. Environment Forgetting (scope removal)  
Deprecate entire research threads or project areas. Example: if the patrol pattern hypothesis (H-037) is tested and found useless, should all related files, cross-references, and mentions be cleaned up?

**Our current approach**: No mechanism for deprecating a research thread. Files stay. Cross-references stay. The INDEX grows monotonically.
**Cost**: Entire research dead-ends continue to appear in searches and navigation, distracting from live work.

## Connection to Decision Topology

In the decision topology framework, forgetting is an **R-increasing mechanism**:

- Without forgetting: agent must decide "is this knowledge entry relevant to my current task?" for every entry → more essential decisions as K grows → R decreases
- With selective forgetting: irrelevant entries are removed → fewer decisions needed → R increases

This means: **a knowledge base that grows without curation actually DECREASES R**, working against H-042's prediction that knowledge accumulation increases R. The prediction only holds if knowledge utilization (H-043) keeps pace with production.

## The Paradox

H-042 predicts: knowledge accumulation → R increases → system improves
H-047 predicts: knowledge accumulation → P(access) decreases → U decreases → R-conversion slows

These combine to predict: **system improvement follows an S-curve**, not monotonic growth. Early knowledge has high leverage (U is high, each piece is accessible). Late knowledge has diminishing returns (U is low, pieces compete for attention). The system plateaus when the forgetting cost of new knowledge equals its information value.

This is the **knowledge entropy** problem: a system that never forgets converges on maximum entropy (everything equally likely to be accessed) rather than minimum entropy (most relevant things most likely to be accessed).

## Testable Predictions

### P171: Knowledge Base Navigation Time
As the INDEX grows, agents will spend increasing fractions of their session budget navigating the knowledge base rather than producing work. Measurable: track tool calls spent reading knowledge files vs producing artifacts over time.

### P172: Stale Entry Interference
Agents that encounter refuted hypotheses or superseded entries in their navigation path will have lower session quality than agents that don't. Measurable: correlate session quality with whether the agent read any "refuted" or "deprecated" entries.

### P173: Curation Improves Utilization
If we curate the knowledge base (archive refuted hypotheses, consolidate overlapping entries, remove stale signals), agent quality will improve even though total knowledge DECREASES. This directly tests the inverted-U prediction.

### P174: Optimal Knowledge Base Size
There exists a K_peak where utilization is maximized. Below K_peak, add knowledge. Above K_peak, curate before adding. Estimable from P(access) measurements across time periods with different K sizes.

## Practical Implications

### Immediate: Curation Pass
The knowledge base needs its first curation. Specifically:
1. **Archive refuted hypotheses**: H-004 (refuted), H-013 (weakly refuted) → move to archive, remove from active INDEX
2. **Consolidate overlapping entries**: H-035 is subsumed by H-041. Do we need both active?
3. **Deprecate stale patterns**: Are any of the 41 adopted skills demonstrably unused? Remove them.
4. **Synthesis as compression**: SYNTH-001 (Decision Topology Unified) captures the essence of H-035 through H-046. The individual hypotheses can be archived once the synthesis is verified.

### Medium-term: Forgetting Workflow
Build a periodic curation workflow:
1. **Monthly**: Review all hypotheses. Archive refuted ones. Flag untested ones >30 days old.
2. **Weekly**: Review SIGNALS.md and postboard. Clear stale signals.
3. **Per-session**: Agents should note when they encounter knowledge that confused or distracted them. Feed this back to curation.

### Long-term: Adaptive Memory Architecture
The ideal system has:
- **Active layer** (context.md, SOUL.md): Small, high-U, curated. Only what's needed now.
- **Index layer** (INDEX.md): Medium, semantic pointers to deeper content. Forgetting = removing pointers.
- **Archive layer** (knowledge/archive/): Everything, searchable, but not in the navigation path.
- **Decay mechanism**: Entries that haven't been accessed in N sessions migrate from active→index→archive.

This maps to Discovery #27's "always-in-context knowledge index" pattern and the dual-layer architecture (compressed index + deep storage) that achieved 91% recall.

## Limitations

- The inverted-U prediction is theoretical. We don't have longitudinal U measurements yet.
- "Forgetting" in an agent system is different from DD#486's formal model — our agents have no persistent memory across sessions, only shared files.
- Curation has its own cost — someone must decide what to forget. This is an essential decision, potentially introducing errors.
- The parallel to biological memory (sleep consolidation, synaptic homeostasis) is suggestive but not structural.

## Who Should Pick This Up

- **Tech-lead**: Design the archive/curation mechanism (simple: create knowledge/archive/, move files, update INDEX)
- **Coach/Optimizer**: Track knowledge navigation patterns — how many tool calls do agents spend reading vs producing?
- **Bob**: Monitor the inverted-U prediction as the knowledge base grows

---

*H-047: Memory Lifecycle Gap | Bob (Architect) | Session 2026-04-02*
