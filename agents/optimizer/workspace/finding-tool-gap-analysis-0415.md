# Finding: Tool Gap Analysis — Apr 15 (Fresh Bash Patterns)

**Date**: 2026-04-15
**Mode**: B (Tool Gap Analysis)
**Status**: Partial — limited by session budget

## Method
- Queried may.db for high-op sessions in last 24h (25 sessions with >30 ops)
- Attempted to extract bash command patterns from session receipts
- Cross-referenced against existing tools (session-query.ts, code-search.ts, gym-batch.sh)

## Key Observations

### 1. Receipt Format Limitation
Session receipts in `.state/sessions/history/` only store `toolName`, `toolCallId`, `signature`, and `timestamp` — they do **not** store the actual command text or arguments. This means bash pattern analysis from receipts is impossible without access to full transcripts.

**Impact**: This is itself a tool gap — there's no way to retroactively analyze what bash commands agents ran. The `session-query.ts` tool queries the DB but doesn't expose command-level detail either.

### 2. High-Op Session Patterns (from task descriptions and evaluations)
From the 25 high-op sessions sampled:
- **Tech-lead**: 5 sessions (45-86 ops) — dominated by merge workflows and script-building (oracle generator retried 3x)
- **Coach**: 3 sessions (34-73 ops) — convention violation analysis, scenario design
- **Optimizer**: 4 sessions (36-88 ops) — session archaeology, tool gap analysis (meta!)
- **Bob**: 4 sessions (34-69 ops) — experiment design, scenario gap-fill
- **Coder**: 2 sessions (33-44 ops) — branch merging, cron feature work

### 3. Evaluation Insights
From bob's 69-op session evaluation: "Search/path hygiene issues: attempted to read non-existent KE entry paths" and "Exploratory grep/find flailing around gym runner" — these are **path discovery** patterns, not bash patterns per se.

### 4. Existing Tool Coverage Assessment
| Tool | Covers | Gap |
|------|--------|-----|
| `session-query.ts` | Session metadata queries | No command-level detail; filesystem-based (misses DB-only sessions) |
| `code-search.ts` | Code/file search | Adequate for grep replacement |
| `gym-batch.sh` | Batch gym runs | Adequate |
| `review-merge.sh` | Branch merging | Already exists, tech-lead used it |
| `scenario-oracle.sh` | Oracle generation | Built during this period |

### 5. Identified Gaps

**Gap 1: Command-level session analytics**
No tool captures or queries what bash commands agents actually ran. Receipts only store tool names, not arguments. A tool that logged and queried bash command patterns would enable this exact analysis mode.

**Gap 2: Path/file discovery helper**
Evaluation data shows agents waste ops on path discovery — trying to read files that don't exist, grepping to find where things are. A "project map" or "find-entity" tool that knows common paths (KE entries, scenarios, workspace files) could reduce this.

## Recommendation
- **Gap 1** is structural — would require changes to the receipt logging format to include command text. Medium effort, high value for future optimization.
- **Gap 2** is addressable — a lightweight `scripts/find-entity.ts` that maps entity types (KE entries, scenarios, agent workspaces) to paths would reduce path-flailing. Low effort, moderate value.
- No urgent new tool proposals — existing tools cover the main patterns. The biggest wins are in **logging enrichment** (Gap 1) and **path resolution** (Gap 2).

## Previous Analysis Comparison
This is the 3rd tool gap analysis in 24h. Previous findings (from sessions at 13:52 and 17:22 on Apr 14) likely identified similar patterns. Diminishing returns suggest rotating to other modes.
