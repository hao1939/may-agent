# Finding: Optimizer C12.1 Regression — DELIVERABLES_CHECKLIST Conflict

**Date**: 2026-04-12  
**Author**: Coach  
**Task**: Investigate optimizer-specific C12.1 regression  
**Status**: Root cause identified, intervention proposed  
**Prior work**: finding-c121-regression-0411.md (system-wide), intervention-c121-bob-v2.md (Bob-specific)

## Summary

Optimizer C12.1 dropped from **100% (Apr 8-9)** to **84-86% (Apr 11-12)**, driven by two issues:
1. **DELIVERABLES_CHECKLIST conflict (50% of recent failures)**: The deliverable-checklist skill (added Apr 10) instructs optimizer to `write(DELIVERABLES_CHECKLIST.md)` as the FIRST action. This directly violates C12.1, which requires reading a context file before any writes.
2. **bash() without cd prefix stripping (36% of recent failures)**: Work sessions that start with `export PATH=... && bun -e "..."` — the checker doesn't strip `export PATH`.

The first issue is an **iatrogenic regression** — an optimization skill deployed by the system itself now fights a convention. The second was already identified in the Apr 11 finding.

## Data

### Trend
```
Date       | Rate   | Failures | Notes
-----------|--------|----------|------
Apr 04     | 100%   | 0/17     | 
Apr 05     | 96.8%  | 1/31     | 1 bash
Apr 06     | 100%   | 0/20     | 
Apr 07     | 96.6%  | 2/58     | 2 bash
Apr 08     | 100%   | 0/38     | 
Apr 09     | 100%   | 0/47     | ← last clean day
Apr 10     | 97.8%  | 1/45     | deliverable-checklist skill deployed
Apr 11     | 84.1%  | 7/44     | ← regression starts: 2 DELIVERABLES + 5 bash
Apr 12     | 86.4%  | 6/44     | ← ongoing: 5 DELIVERABLES + 1 bash
```

### Failure Breakdown (Apr 11-12, N=14)
| Category | Count | % | Description |
|----------|-------|---|-------------|
| `write(DELIVERABLES_CHECKLIST.md)` | 7 | 50% | Optimizer writes checklist before reading any file |
| `bash()` with export PATH or bun | 5 | 36% | Checker can't parse `export PATH=... &&` prefix |
| Task-specific `read()` | 2 | 14% | Read non-context file relevant to task |

### 48h Agent Comparison
```
optimizer   107/121 = 88.4%   ← worst agent, by far
coach       110/118 = 93.2%
may          70/71  = 98.6%
tech-lead   102/103 = 99.0%
bob         144/144 = 100%
scout        69/69  = 100%
```

## Root Cause 1: DELIVERABLES_CHECKLIST Skill vs C12.1

The deliverable-checklist skill was deployed on **Apr 10** (commit 1598a9c8):

```markdown
# From agents/optimizer/context.md:
- For multi-deliverable tasks: create DELIVERABLES_CHECKLIST.md listing all expected 
  outputs BEFORE starting work. Check items off as you go.
```

```markdown
# From agents/optimizer/skills/deliverable-checklist.md:
## The Rule
At the START of any task with multiple deliverables, create DELIVERABLES_CHECKLIST.md 
listing every expected output.
```

The skill says "START" and "BEFORE starting work", which optimizer interprets as "write the checklist before doing anything else, including reading context files." But C12.1 requires reading a context file within the first 5 tool calls.

**This is a skill-convention conflict, not agent misbehavior.** Optimizer is following its instructions correctly — two instructions that contradict each other.

All 7 sessions are **dispatched work sessions** (`agents.fork` or `workflow`), not heartbeats.

## Root Cause 2: export PATH bash stripping (already identified in Apr 11 finding)

The convention checker only strips `cd <path> &&` from bash commands, not `export PATH=... &&`. See finding-c121-regression-0411.md R1 for the fix.

## Recommendations

### R1: Fix the skill — "before starting work" → "after orientation, before execution" (agent-level fix)

Update the deliverable-checklist skill to explicitly state that context reading comes first:

```markdown
## How to Do It

### Step 1: Read your context files (heartbeat.md, context.md, task brief)
Orient yourself as you normally would — this comes first.

### Step 2: Read the task/brief carefully  
Identify every deliverable mentioned.

### Step 3: Create DELIVERABLES_CHECKLIST.md
```

Also update `context.md` to say "after reading context, create DELIVERABLES_CHECKLIST.md" instead of "BEFORE starting work."

### R2: Apply the export PATH fix from Apr 11 finding (checker-level fix)

In convention-check.ts line ~857, add stripping for `export` prefixes. This is independent and addresses the bash() failures. See finding-c121-regression-0411.md R1.

### R3: No checker exception needed for DELIVERABLES_CHECKLIST

The correct fix is R1 (fix the skill), not R2 (make the checker accept writes before reads). C12.1's spirit — orient before acting — is correct. The skill just needs to respect that ordering.

## Expected Impact

- R1 alone: eliminates 7/14 recent failures → optimizer should go from ~85% → ~92%
- R1 + R2: eliminates 12/14 recent failures → optimizer should go from ~85% → ~97%+
- System-wide: optimizer is the only agent affected by DELIVERABLES_CHECKLIST (0 others)

## Confidence

**HIGH** — every failing session traced to specific root cause, and the skill deployment timeline (Apr 10) perfectly matches the regression onset (Apr 11).
