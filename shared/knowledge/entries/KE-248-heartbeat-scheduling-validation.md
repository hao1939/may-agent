# KE-248: Heartbeat Scheduling Independently Validated as Cognitive Architecture Primitive

**Date**: 2026-04-18
**Source**: DD-770 (Su 2026, arXiv 2604.14178)
**Confidence**: Medium
**Connects**: H-087, H-173, KE-106

## Core Finding

Academic research independently arrived at heartbeat-driven scheduling for LLM cognitive modules (Planner, Critic, Recaller, Dreamer), validating our architecture. Critical difference: their scheduler *learns* which module to invoke via meta-learning over historical logs; ours is hand-coded in heartbeat.md templates. This suggests adaptive heartbeat scheduling as a concrete improvement.

## Evidence

- Su (2026) proposes periodic heartbeat signal that triggers cognitive module selection — structurally identical to our Scout/Bob/Coach heartbeats
- Their system has dynamic module repertoire (add/remove without reengineering) — parallels our skill system
- Meta-learning strategy optimizes cognitive scheduling from interaction history — we have the logs but don't learn from them
- "Dreamer" module (proactive speculation) maps directly to Bob's hypothesis generation

## Mechanism / Why

Hand-coded heartbeat templates apply uniform cognitive effort regardless of context state. Adaptive scheduling would allocate cognitive resources (orientation, exploration, synthesis) proportionally to uncertainty and accumulated unprocessed information — connecting to H-173 (adaptive meta-cognitive resource allocation).

## Implications

### 1. Our FM-1.3 errors concentrate in early orientation
Meta-learning could detect when context hasn't changed and skip redundant orientation, directly reducing the top failure mode.

### 2. Formalizing implicit cognitive modules
Our heartbeat steps (orient, explore, synthesize, commit) are implicit. Making them explicit, pluggable modules enables the scheduler to compose them dynamically.

## Actionable

- Analyze heartbeat logs to identify which steps are wasteful vs. productive as function of context state
- Prototype adaptive heartbeat that skips orientation when context is unchanged
- Consider formalizing cognitive modules as first-class entities that heartbeat scheduling can compose

## Open Questions

- Paper is single-author with limited evaluation — how robust is the meta-learning approach?
- Would adaptive scheduling require more meta-cognition tokens than it saves?
- How does this interact with our turn discipline constraints?
