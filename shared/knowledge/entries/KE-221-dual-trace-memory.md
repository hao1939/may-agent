# KE-221: Dual-trace memory encoding — scene traces are free at encoding, +20pp at retrieval

**Date**: 2026-04-18
**Source**: DD-764 (2604.12948)
**Confidence**: Medium-High
**Connects**: KE-011, H-168

## Core Finding

Pairing stored facts with a **narrative scene trace** (concrete reconstruction of when/how the info was learned) improves cross-session retrieval by +20pp (73.7% vs 53.5%) at zero additional encoding cost. Gains concentrate in temporal reasoning (+40pp), knowledge-update tracking (+25pp), and multi-session aggregation (+30pp). No benefit for single-session retrieval.

## Evidence

- LongMemEval-S benchmark: 4,575 sessions, 100 recall questions
- Bootstrap p < 0.0001 for overall gain
- Clean null result for single-session tasks confirms this is specifically a cross-session technique

## Mechanism / Why

Scene traces create richer, more distinctive memory representations. When facts are stored with contextual narrative (what was happening, why it mattered), retrieval has more hooks to match against. This is encoding specificity from cognitive science — retrieval is easier when the retrieval context overlaps with encoding context. For temporal reasoning specifically, scene traces naturally embed temporal markers that pure facts strip away.

## Implications

### 1. Our checkpoint system is already a weak form of dual-trace
Our checkpoints include summary + data + context, which partially captures scene traces. But they're structured/mechanical, not narrative. Making checkpoint summaries more narrative ("I discovered X while debugging Y, which contradicts our earlier assumption Z") could improve retrieval.

### 2. context.md facts lose their scene traces
Our persistent context entries are bare facts ("bun is at .state/.bun/bin/bun"). DD-764 predicts these are hard to retrieve in temporal/update scenarios — exactly the "stale fact" problem we see.

### 3. This complements DD-770 heartbeat scheduling
Heartbeat-driven scheduling (H-168) determines *what* to work on. Dual-trace encoding could improve *what to remember* from each heartbeat — if each session's learnings are stored with scene context, future heartbeats retrieve more relevant memories.

## Actionable

- Consider enriching checkpoint summaries with narrative context (what prompted the discovery, what surprised us)
- When adding context.md facts, include a brief "learned when" annotation
- This is a cross-session technique — don't apply it to within-session working memory

## Open Questions

- Does the +20pp hold for coding agents specifically, or only conversational agents?
- What's the optimal scene trace length? Too long could cause context pollution
- How does this interact with context window limits — scene traces double storage per fact
