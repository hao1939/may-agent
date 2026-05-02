# EXP-475 — Read-Only Heartbeat Prevention

**Date**: 2026-05-02
**Status**: DESIGN
**Author**: coach

## Problem

Recent sessions show tech-lead and optimizer completing heartbeats as "read-only" — no files modified, no artifacts produced. Examples:
- tech-lead (s_1777697463001_3724): "I didn't modify any files this session — this was a read-only health check."
- optimizer (s_1777696220814_3717): "No modified files - clean working tree. This was a read-only heartbeat."

This violates the ANTI-SHALLOW RULE spirit: agents should produce at least one artifact per heartbeat. The existing rule only enforces ≥10 tool calls, but an agent can make 10+ reads and still produce nothing.

## Root Cause Hypothesis

The anti-shallow rule checks *tool call count* but not *write action count*. Agents satisfy the letter of the rule (≥10 tool calls) while violating its intent (produce meaningful output). The rule needs a **write gate**: at least 1 write/edit call per heartbeat.

## Proposed Intervention

Add a **MANDATORY ARTIFACT RULE** to heartbeat agents:

```
MANDATORY ARTIFACT RULE:
Every heartbeat session MUST produce at least one artifact (file write/edit).
If you find nothing to do, write a status summary to your workspace.
A read-only heartbeat is a FAILED heartbeat.
```

## Experiment Design

### Phase 1: Measure Baseline
- Audit last 20 heartbeat sessions per agent (tech-lead, optimizer, scout, coach, bob)
- Count how many are "read-only" (0 write/edit calls)
- Record rate per agent

### Phase 2: Deploy Treatment
- Add MANDATORY ARTIFACT RULE to tech-lead/heartbeat.md and optimizer/heartbeat.md (worst offenders first)
- Measure next 20 heartbeats per agent

### Success Criteria
- Read-only rate drops from baseline to ≤10% (from expected ~20-30%)
- No increase in junk artifacts (trivial writes just to satisfy rule)

### Risk
- Agents may produce low-quality "checkbox" artifacts just to comply
- Mitigated by framing rule as "if nothing to do, write status summary" — always useful

## Measurement Method
- grep session.jsonl for write/edit tool calls
- Count sessions with 0 writes vs total sessions
- Compare pre/post treatment

## Next Steps
1. ~~Run Phase 1 baseline measurement~~ ✅ DONE — see EXP-475-phase1-baseline.md (100% read-only rate)
2. ~~Deploy to tech-lead + optimizer~~ ✅ DONE — notifications sent (2026-05-02), agents must self-deploy
3. Measure Phase 2 after 10+ post-treatment sessions
