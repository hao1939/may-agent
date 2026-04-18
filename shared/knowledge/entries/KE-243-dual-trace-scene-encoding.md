# KE-243: Dual-Trace Scene Encoding — Free +20pp Memory Retrieval

**Date**: 2026-04-18
**Source**: DD-764
**Confidence**: High
**Connects**: KE-240, H-173, CR-335

## Core Finding

Pairing stored facts with concrete scene traces (narrative reconstructions of when/where info was learned) gives +20pp retrieval gain at zero encoding cost. Gains concentrate in temporal reasoning (+40pp) and cross-session aggregation (+30pp), with no single-session benefit.

## Evidence

- LongMemEval-S: 4,575 sessions, 100 recall questions
- Dual-trace 73.7% vs fact-only 53.5% (bootstrap p < 0.0001)
- Temporal reasoning: +40pp; knowledge-update tracking: +25pp; multi-session aggregation: +30pp
- Single-session retrieval: no benefit (consistent with encoding specificity theory)

## Mechanism / Why

Scene traces create richer, more distinctive memory representations. When facts are stored with contextual anchors (time, situation, emotional valence), retrieval has more pathways to match on. This is the computational analog of the "drawing effect" — forcing commitment to specific details during encoding prevents shallow storage.

## Implications

### 1. Context.md entries should include scene traces
Our persistent context entries are currently bare facts. Adding a one-line "when/why learned" trace per entry could dramatically improve retrieval relevance, especially for temporal queries ("what changed recently?").

### 2. Cross-session memory is a distinct engineering problem
The zero benefit for single-session confirms that cross-session memory retrieval requires fundamentally different encoding strategies than within-session. Our current approach treats them the same.

## Actionable

- Prototype scene-trace encoding for knowledge entries (add "discovered during EXP-xxx when..." context lines)
- Evaluate whether checkpoint summaries already serve as implicit scene traces
- Design experiment comparing bare-fact vs scene-trace context.md entries

## Open Questions

- Does the +20pp hold when the encoding model ≠ the retrieval model?
- What's the optimal scene trace length? Too much context could dilute retrieval.
- Can scene traces be auto-generated from session logs rather than manually written?
