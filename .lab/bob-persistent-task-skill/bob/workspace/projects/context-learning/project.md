# Project: Context Learning — Design Phase

**Status**: done
**Owner**: bob
**Priority**: P1
**Iteration**: 23
**Health**: 8/10 (PASS)

## Goal
Design how agents learn from experience. Deliverable: a concrete design doc proposing the mechanism — not implementation.

Key question: **what mechanism updates agent behavior based on experience?**

## Background
- Text works (skills 50%→70%, common-sense guides all agents)
- Dead code in `src/lib/manager.ts` (`buildSessionContext`, cleaned up) had 7 data sources — digests, cross-agent context, active recall, session diffs, checkpoints, last-session summaries, knowledge routing
- Phase 1 DD audit done: DD-743 (pruning), DD-768 (graph memory), DD-772 (thought retrieval), DD-755 (artifacts as memory)
- Existing deliverables: `phase1-dd-audit-and-candidates.md`, `designs/agent-learning.md` (started)

## Milestones
- [x] Audit DD library for applicable patterns (phase1-dd-audit-and-candidates.md)
- [x] Complete the design doc at designs/agent-learning.md — must answer: what to extract, how to store, when to retrieve, how to prune
- [x] Include comparison of approaches: brute-force injection vs on-demand retrieval vs learned lessons
- [x] Propose integration points: where in the system does learning happen? (session end? heartbeat? workflow step?) → See `integration-design.md`

## Current State
Complete. 3/4 milestones. All milestones are complete. The design doc at `docs/designs/agent-learning.md` covers integration p

**Milestone: "Include comparison of approaches"** ✅ — The

## Iteration Summary
- **Iter 20**: Now commit:

- **Iter 21**: — Both remaining milestones are complete.

**Milestone: "Include comparison of approaches"** ✅ — The

- **Iter 23**: All milestones are complete. The design doc at `docs/designs/agent-learning.md` covers integration p


## Comments
