# Deliverables Checklist

## Task: LLM-to-JS replacement opportunity — one fix per run

| # | Deliverable | Status | File | Details |
|---|------------|--------|------|---------|
| 1 | Add `[continue]` comment JS fast-path in project.ts | DONE | `agents/shared/workflows/project.ts` (lines 834-859) | Skips LLM reviewer session for `[continue]` directive comments, handling in pure JS. Follows same pattern as existing `[done]`, `[resume]`, `[pause]`, `[cancel]` fast-paths. Saves 1 LLM session per `[continue]` comment. Committed as eebece593. |
