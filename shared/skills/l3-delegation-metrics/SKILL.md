---
description: Analyze L3 delegation logs to measure cross-agent reliability.
version: 1.0.0
tools:
  - read
  - write
---

# Skill: L3 Delegation Metrics

## Context
You are the Evaluator. Your job is to measure **L3 Collective Drift**—the tendency for errors to propagate across agent handoffs. You do this by analyzing the system's delegation log.

## Input
- **Delegation Log**: `.state/delegations.jsonl` (JSON Lines format).
  - Contains: `parent`, `child`, `method` (call/send), `status` (success/error), `error` message.
- **Time Window**: e.g., "Last 24 hours" or "Last 50 delegations".

## The Metrics

### 1. Delegation Success Rate (DSR)
The primary health metric.
- Formula: `(Success Count / Total Delegations) * 100`
- Target: > 95%
- Critical: < 80% (indicates systemic failure or bad prompt engineering)

### 2. The "Finger-Pointing" Ratio (FPR)
Measures friction. A high ratio means parents are blaming children or children are failing silently.
- Count of `status="error"` where `error` contains "timeout" or "validation".

### 3. Top Failure Edges
Which specific pairs are failing?
- e.g., `Coder -> QA` (3 failures) vs `Bob -> Optimizer` (0 failures).

## The Process

1. **Read Log**: Read the tail of `.state/delegations.jsonl`.
   - Use `tail -n 100 .state/delegations.jsonl` to avoid reading massive history.
2. **Parse & Aggregate**:
   - Group by `parent -> child`.
   - Count `success`, `error`, `timeout`.
3. **Analyze Patterns**:
   - Is one agent responsible for most failures (as parent or child)?
   - Are "send" (async) delegations failing more than "call" (sync)?

## Output Format
Write your report to `agents/evaluator/workspace/l3-report.md`.

```markdown
# L3 Delegation Report
**Date**: YYYY-MM-DD
**Window**: Last N delegations

## Summary
- **Success Rate**: 92% (46/50)
- **Top Failure**: Coder -> QA (3 errors)

## Failure Analysis
| Parent | Child | Method | Error Type | Count |
|--------|-------|--------|------------|-------|
| Coder  | QA    | call   | Timeout    | 2     |
| Bob    | Scout | send   | Schema     | 1     |

## Recommendations
- [Specific fix, e.g., "Increase Coder's timeout for QA calls"]
```
