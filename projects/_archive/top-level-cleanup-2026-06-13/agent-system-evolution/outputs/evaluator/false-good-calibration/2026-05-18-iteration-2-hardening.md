# Iteration 2 Hardening — 2026-05-18

## Change summary
- Hardened `transcriptOutputSignals()` in `agents/evaluator/workflows/evaluator-aftermath.ts` so `project artifact` and `knowledge update` come only from actual assistant `write` / `edit` / `apply_patch` tool-call paths.
- Kept `classifyEvaluationLane()` at existing thresholds, but ensured `good` sessions with only non-material signals stay `routine_ok` unless the finish/uncommitted self-repair path applies.
- Added focused regression tests in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` for dirty-worktree contamination and positive knowledge-write detection.

## Before / after examples
### Before hardening
A transcript containing only bash output like this could create false material signals:

```text
git status --short
 M projects/example/outputs/result.md
 M agents/evaluator/knowledge/criteria.md
```

Because routing looked for `projects/...` and `agents/.../knowledge/...` in raw transcript text, a `good` session could be promoted to `success_candidate` even if it never wrote those files.

### After hardening
The same dirty-worktree bash output no longer produces `project artifact` or `knowledge update` signals. The new regression expects only:

```text
["verification command", "project-linked session", "workflow-linked session"]
```

and the route stays:

```text
routine_ok
```

### Positive case retained
A real assistant tool call like:

```json
{"name":"write","arguments":{"path":"agents/evaluator/knowledge/new-pattern.md","content":"pattern"}}
```

still produces:

```text
["file write/edit", "knowledge update", "verification command"]
```

and remains routed as:

```text
success_candidate
```

## Focused test command and output
Command:

```bash
cd /app && bun test ./agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts
```

Output:

```text
42 pass
0 fail
89 expect() calls
Ran 42 tests across 1 file.
```

## 24h event volume check
Using `events.timestamp` over the last 24h at check time:

- `evaluation.false_good`: 52
- `evaluation.reviewed`: 132
- `evaluation.success_candidate`: 113

This change should reduce false-good churn because iteration-1 found 29/30 recent false-good cases were routed by material-output signals, and this hardening removes the dominant contamination path from dirty-worktree/bash text without broadening thresholds.
