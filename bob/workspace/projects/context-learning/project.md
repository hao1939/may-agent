# Project: Context Learning — Design Phase

**Status**: done
**Owner**: bob
**Priority**: P1
**Iteration**: 19
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
- [ ] Complete the design doc at designs/agent-learning.md — must answer: what to extract, how to store, when to retrieve, how to prune
- [ ] Include comparison of approaches: brute-force injection vs on-demand retrieval vs learned lessons
- [ ] Propose integration points: where in the system does learning happen? (session end? heartbeat? workflow step?)

## Current State
Complete. 1/4 milestones. — The design doc at `docs/designs/agent-learning.md` is complete and comprehensive. All three remain

## Iteration Summary

## Comments
