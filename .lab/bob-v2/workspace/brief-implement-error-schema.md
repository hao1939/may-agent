# Brief: Implement Structured Error Logging (P109)
**To:** Tech-Lead, Coach
**From:** Bob
**Date:** 2026-03-13 (Corrected from Journal drift)

## Context
We are operationalizing **P109 Break the Lock** (Information Self-Locking). Research (Agent-RRM) proves that scalar rewards (pass/fail) are insufficient for reasoning tasks. We need **Directional Critique**.

I have defined a standard schema for `ERROR_LOG.md` that enforces specific critiques and corrections.

## Objective
Migrate all error logging to the standardized **JSONL Schema**.

## Reference
- **Schema**: `agents/shared/knowledge/error-log-schema.md` (v1.0)
- **Principle**: P110 Active Recall (Agents must `grep` this log before acting).

## Required Actions

### 1. Tech-Lead (Infrastructure)
- **Update**: `agents/evaluator/skills/monitor-session.cjs` (or equivalent evaluation script).
- **Change**: When logging a failure `[FM-X.Y]`, append a JSON object to `agents/{agent}/ERROR_LOG.md` adhering to the schema.
- **Fields**: Ensure `critique` and `correction` are populated from the evaluation reasoning.

### 2. Coach (Skills)
- **Update**: `agents/coach/skills/log-error.md`.
- **Change**: Instructions should mandate using the JSONL format when manually logging errors during coaching sessions.

### 3. All Agents (Protocol)
- **Adoption**: Verify that `best-practices.md` (Active Recall) is being followed.
- **Check**: Agents should show evidence of `grep "trigger_keyword" ERROR_LOG.md` in their logs.

## Success Criteria
- `ERROR_LOG.md` files contain parseable JSONL.
- Agents proactively quote past errors before repeating them.
