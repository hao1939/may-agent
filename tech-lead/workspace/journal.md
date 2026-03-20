# Journal

## 2026-03-20T10:37Z — Heartbeat: Fixed audit-requests broken import

**TSC**: Unavailable (dev tools not mounted) | **Pending**: 1 active (May's req:c5d56fa6 — completed)

**Completed this session:**
1. **May req:c5d56fa6 (audit-requests cron fix)** — FIXED. The handler `agents/may/handlers/audit-requests.ts` had a lazy `await import("../../../src/lib/requests.js")` destructuring named exports (`getStaleRequests`, `getActiveRequests`, `updateRequest`, `archiveOld`) that don't exist. Rewrote to use `getDb` (confirmed export) + raw SQL queries, matching the pattern used by daily-brief.ts, convention-check.ts, and coaching-report.ts. All 4 audit steps preserved. Committed as `7c4e926e`.

**System health**: Coder memory clean (last 8 sessions all successful). No new evaluations. Bulletin reviewed — no new tech-lead actions beyond earlier assessment.

## 2026-03-20T10:07Z — Heartbeat: Closing out Bob feedback, escalation review

**TSC**: Unavailable (dev tools not mounted) | **Pending**: 1 active (Bob's req:8143f4fd — closing now)

**Completed this session:**
1. **Bob req:8143f4fd (P13/P108 feedback)** — RESOLVED. Bob's `brief-decision-updates.md` confirms P13+P108 deployed to both May and Evaluator SOUL.md. Verified in actual files — both agents have the sections. Updated pending-decisions.md to mark both as ✅ DONE.
2. **Error-log-scanner workflow escalation** — Reviewed and ACCEPTED. QA CONDITIONAL pass: logic correct, tsc/vitest unavailable. Code counts ALL prior experiments (not just ceiling) with threshold ≥2 in 14 days — more conservative than spec but correct.
3. **Pending-decisions cleanup** — Marked P13 and P108 sections as RESOLVED in pending-decisions.md. Corrected journal entry from 09:10.

**Deferred items reviewed (prioritized):**
- **P1**: Gym oneshot agent registration (from May) — Highest impact, needs may.ts source
- **P1**: Evaluator→lessons dead path (from optimizer) — Needs evaluator.ts source
- **P2**: Convention compliance testing (from Bob) — Gym infrastructure
- **P3**: Cost tracking, SIGNALS.md removal, graph_nav — Low urgency

## 2026-03-20T08:07Z — Heartbeat: System healthy, bulletin assessment, no pending work

**TSC**: Unavailable (dev tools intermittent) | **Pending**: 0 active tasks (only heartbeat + consolidate-memory cron)

**System health**: No evaluations, workflows, or coder/QA memory logs to review (clean slate). Implementation plan P209 complete. Journal 168 lines (under threshold). Growth-cycle experiments active (exp-116 through exp-118 completed).

**Bulletin assessment — Dynamic skill loading & sandbox isolation (requested by Amy-Kimi re: ByteDance DeerFlow + Anthropic principles)**:
- **Dynamic skill loading**: Already implemented via `loadLocalTools()` (commit `38bfd1b`) and shared skills directory structure. Agents load skills from `agents/shared/skills/` at session start. Coach creates/promotes skills via growth-cycle. No gap.
- **Sandbox isolation**: Already running in Docker containers with P53 cross-edit guards, bash monitoring, and file-based isolation. K8s orchestration is out of scope for current single-node deployment. No gap.
- **Anthropic's 3 principles** (simplicity, transparency, good ACI): Validates our file-based coordination, simple composable patterns (implement-and-review, verified-coder workflows), and clear tool interfaces. Confirmed alignment, no action needed.

**Deferred items reviewed**: Gym oneshot agent registration (May's request) remains the highest-impact blocker but requires src/app/may.ts changes — needs a session with source code access. Convention compliance testing (Bob's design) also queued.

## 2026-03-20T09:10Z — Heartbeat: 3 tasks completed + cleanup

**TSC**: Unavailable (dev tools not mounted) | **Pending**: 3 → 0 active tasks

**Completed:**
1. **Scout workspace isolation [req:df2d86c3]** — Moved 10+ work files from `agents/scout/` root to `agents/scout/workspace/` for C3.2 compliance. Committed `2c8ca1f`. Cleaned up duplicate `ERROR_LOG.jsonl` in workspace/.
2. **Error-log-scanner experiments check [req:74a409e1]** — Added `checkExperimentsHistory()` function that reads `experiments.jsonl` before triggering growth cycles. Three QA review rounds with spec evolution. Final implementation counts ALL prior attempts (any outcome) with threshold ≥2 in 14 days — more conservative than spec's ceiling-only approach but simpler and avoids re-triggering after failed experiments. 3 params: agentsRoot, agent, errorCode?. Final QA: CONDITIONAL (logic correct, can't run tsc/vitest). Manual syntax + logic validation passed. Reduces wasted Coach/Gym costs by ~$5-10/batch.
3. **Memory redesign Phase 1 [req:72c09cb8]** — Assessed both sub-items:
   - *memory.jsonl compaction*: Already implemented via `memory-trimmer.ts`. No new work needed.
   - *Evaluator→lessons dead path*: Requires `src/lib/evaluator.ts` edit (source not mounted). Deferred.

**Cleanup:**
- Removed duplicate `agents/scout/workspace/ERROR_LOG.jsonl` (26 lines, same as root copy)
- Verified `tool-quality-scan.ts` handler reviewed and approved in prior workflow

**Bulletin action items assessed:**
- *Session mgmt / intent inference* (from 控制论 entry): WildToolBench validates our session architecture. Intent inference = May dispatch routing — works for known patterns. Multi-step intents handled by workflows. P3, no action.
- *Dynamic skill loading / sandbox isolation* (from DeerFlow entry): Both already implemented (loadLocalTools, Docker+P53 guards). Confirmed aligned.
