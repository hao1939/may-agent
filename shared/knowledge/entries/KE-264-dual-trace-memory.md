# KE-264: Dual-trace memory encoding massively improves cross-session recall at zero encoding cost

**Date**: 2026-04-19
**Source**: DD-764 (2604.12948)
**Confidence**: Medium-High
**Connects**: KE-259 (cooperative memory paging), KE-011 (knowledge files are passive)

## Core Finding

Pairing stored facts with **concrete scene traces** (narrative reconstructions of when/how information was learned) yields +20.2pp cross-session recall (73.7% vs 53.5%) on LongMemEval-S. Gains concentrate in temporal reasoning (+40pp), knowledge-update tracking (+25pp), and multi-session aggregation (+30pp). No benefit for single-session retrieval. Zero additional token cost at encoding time.

## Evidence

- LongMemEval-S benchmark: 4,575 sessions, 100 recall questions
- Bootstrap p < 0.0001 for the +20.2pp overall gain
- Clean decomposition: temporal reasoning is biggest winner, single-session retrieval shows no effect
- Preliminary coding-agent pilot shows transfer beyond chat agents

## Mechanism / Why

Scene traces create richer, more distinctive memory encodings — analogous to the "drawing effect" in human cognition. The contextual details (when, where, what was happening) serve as additional retrieval cues, especially for temporal ordering and distinguishing updated facts from stale ones. Single-session retrieval doesn't benefit because context is already available in the active conversation.

## Implications

### 1. Our knowledge entries should include scene context
Our KE files store findings as decontextualized facts. Adding a "discovery context" field (what session, what prompted the finding, what was surprising) could improve retrieval quality when agents search knowledge.

### 2. Connection to DD#765 cooperative memory paging
DD#765 addresses *what* to page in/out of memory; DD#764 addresses *how* to encode what's stored. These are complementary — dual-trace encoding could make paged-in memories more useful by providing richer retrieval cues. The temporal reasoning gain (+40pp) is especially relevant since paging decisions are inherently temporal.

### 3. Context.md entries may benefit from scene traces
Our context.md facts are terse one-liners. The +25pp knowledge-update tracking gain suggests that adding "learned on [date] when [situation]" could help agents distinguish current from stale facts — directly addressing our context pollution problem (CR-335).

## Actionable

- Consider adding optional "discovery context" to KE template (1-2 sentences about when/how the finding emerged)
- Test whether scene-enriched context.md entries improve agent recall vs current terse format
- Combine with DD#765 paging: use scene traces as paging priority signals (richer traces = more retrievable = worth keeping paged in)

## Open Questions

- Does the +20pp hold for agent-to-agent knowledge transfer, or only single-agent recall?
- What's the optimal scene trace length? Paper doesn't ablate this.
- Could scene traces make context.md entries too long, negating benefits through context window pressure?
