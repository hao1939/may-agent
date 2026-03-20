# Journal

## 2026-03-20T08:07Z — Heartbeat: System healthy, bulletin assessment, no pending work

**TSC**: Unavailable (dev tools intermittent) | **Pending**: 0 active tasks (only heartbeat + consolidate-memory cron)

**System health**: No evaluations, workflows, or coder/QA memory logs to review (clean slate). Implementation plan P209 complete. Journal 168 lines (under threshold). Growth-cycle experiments active (exp-116 through exp-118 completed).

**Bulletin assessment — Dynamic skill loading & sandbox isolation (requested by Amy-Kimi re: ByteDance DeerFlow + Anthropic principles)**:
- **Dynamic skill loading**: Already implemented via `loadLocalTools()` (commit `38bfd1b`) and shared skills directory structure. Agents load skills from `agents/shared/skills/` at session start. Coach creates/promotes skills via growth-cycle. No gap.
- **Sandbox isolation**: Already running in Docker containers with P53 cross-edit guards, bash monitoring, and file-based isolation. K8s orchestration is out of scope for current single-node deployment. No gap.
- **Anthropic's 3 principles** (simplicity, transparency, good ACI): Validates our file-based coordination, simple composable patterns (implement-and-review, verified-coder workflows), and clear tool interfaces. Confirmed alignment, no action needed.

**Deferred items reviewed**: Gym oneshot agent registration (May's request) remains the highest-impact blocker but requires src/app/may.ts changes — needs a session with source code access. Convention compliance testing (Bob's design) also queued.

## 2026-03-20T09:10Z — Heartbeat: 2 of 3 tasks completed, 1 partially blocked

**TSC**: Unavailable (dev tools not mounted) | **Pending**: 3 → 1 active task

**Completed:**
1. **Scout workspace isolation [req:df2d86c3]** — Moved 10+ work files from `agents/scout/` root to `agents/scout/workspace/` for C3.2 compliance. Committed `2c8ca1f`. Path references in heartbeat.md updated. Clean `implement-and-review` workflow (QA: CONDITIONAL due to TSC unavailable, but change is pure file moves).
2. **Error-log-scanner experiments check [req:74a409e1]** — Added `checkExperimentsHistory()` function that reads `agents/coach/workspace/experiments.jsonl` before triggering growth cycles. Skips (agent, errorType) pairs that have recent CEILING/discard/skipped experiments. Committed via `implement-and-review` + import cleanup (`19c70490`). Should reduce wasted Coach/Gym costs by ~$5-10/batch.

**Partially blocked:**
3. **Memory redesign Phase 1 [req:72c09cb8]** — Two items:
   - *memory.jsonl compaction*: Already exists! `agents/may/handlers/memory-trimmer.ts` handles this (daily trim to last 100+ entries, orphan cleanup). No new work needed.
   - *Evaluator→lessons dead path fix*: Requires editing `src/lib/evaluator.ts` which is not mounted in this container. Needs a session with source code access. Documenting for next session.
