# EXP-870: Structural Enforcement of Read-After-Edit

**Status**: DESIGNED
**Created**: 2025-05-07
**Author**: bob

## Problem

KE-EXP027 shows text-based interventions have 0% success rate for changing agent behavior. Yet we have 33+ "MUST/MANDATORY" rules in agent context files — pure text. The most common: "read() after every edit()" (appears in 6+ agent contexts, with documented violation counts of 13-31).

We are violating our own strongest finding by continuing to rely on text rules.

## Hypothesis

A structural/environmental enforcement mechanism for read-after-edit will achieve ≥80% compliance, versus the current text-only approach which achieves <50% compliance.

## Proposed Structural Interventions (pick one for testing)

### Option A: Tool-Chain Gate (infrastructure)
Modify the tool execution layer to emit a warning/reminder when edit() is called without a subsequent read() before the next edit()/write()/finish(). This is a "soft structural" intervention — the environment surfaces the gap.

### Option B: finish() Rejection (hard structural)  
Modify finish() to check session tool history. If any edit() lacks a following read() on the same file, reject the finish() call with an error message. Agent must comply to complete.

### Option C: Automated Post-Edit Read Injection
After every edit() call, automatically inject the read() result into the response. Zero agent effort required — compliance becomes 100% by construction.

## Design Choice

**Recommended: Option C** — eliminates the behavior entirely. No compliance gap possible. Matches KE-EXP027: best interventions make the wrong thing impossible, not just discouraged.

**Fallback: Option A** — if Option C has performance/token concerns (auto-reads add context window cost), Option A provides a lightweight structural nudge.

## Measurement Plan

- **Baseline**: Audit last 50 sessions across agents for read-after-edit compliance rate
- **Treatment**: Deploy structural mechanism, measure next 50 sessions
- **Success**: ≥80% compliance (Option A) or 100% by construction (Option C)
- **Secondary**: Does forced verification catch real errors? Track edit-then-fix sequences.

## Connection to KE-EXP027

This experiment directly applies our strongest knowledge entry. If successful, it provides a template for converting ALL remaining text-MUST rules into structural guarantees. The 33 text rules become candidates for structural enforcement, prioritized by violation frequency.

## Next Steps

1. Audit baseline compliance rate (sample 20 recent sessions)
2. Prototype Option C in tool infrastructure
3. Run A/B if token cost is a concern; otherwise deploy Option C directly

## Risk

Option C increases token usage (~500-2000 tokens per edit for the auto-read). For agents making 10+ edits per session, this could add 5-20K tokens. May need file-size limits on auto-read.
