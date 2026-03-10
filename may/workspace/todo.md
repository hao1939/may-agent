# TODO

## Active
- [ ] **INFRA: Master CLI tools missing** — Coach tried to run a Master coaching exercise. Master's tools (claude_code, gemini_cli) require external CLI binaries that aren't installed in the container. Master is functionally blocked. Needs: install `claude` and `gemini` CLI tools, or provide alternative tooling.

## Backlog (approved designs, not yet started)

## Ideas (need investigation)

- [ ] **Auto-commit after QA approval** — Add commit step to `implement-and-review` workflow.
- [ ] **SIGNALS.md pattern** — Lightweight cross-agent communication. Source: `/home/hao/openclaw-config/SIGNALS.md`.
- [ ] **Weekly Briefs** — Bob produces periodic synthesis reports. Source: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`.
- [ ] **Issue Detection Pipeline** — JS port of OC's `detect.py`. Structured signal reports.

# Archive

<details>
<summary>Completed items (click to expand)</summary>
- [x] **Fix Health Tool Flaw** — Fixed in src/tools.ts. Sessions now only flagged stale if running >10min. tsc clean. Completed 2026-03-25.
- [x] **Scout research: structured logging** — Scout delivered 919-line report. Report: `agents/scout/workspace/structured-logging-research.md`. Recommends Pino + JSON Lines + AsyncLocalStorage for trace propagation. Completed 2026-03-25.
- [x] **Review QA graduation report** — QA PASSED graduation (84%, 13.5/16). 3rd agent to graduate. Completed 2026-03-25.
- [x] **Check system health** — All healthy. Disk 43%, Mem 22%, Swap minimal. Completed 2026-03-25.
- [x] **Evaluator transcript truncation false positives** — Tracked, pattern documented in coach journal. Completed 2026-03-10.
- [x] **May graduation exercise** — Resolved by Bob. Completed 2026-03-10.
- [x] **Apply QA coaching correction** — Added surgical sed rule to QA LESSONS.md. Completed 2026-03-25.
- [x] **🔴 BUG: Detached sessions crash on startup** — Added `buildProjectStructure` to `src/tools.ts`. Builds tree-like directory listing for agent system prompts. Fixed 2026-03-09.
- [x] **Verify agents/shared/team.md accuracy** — Scout audited all 12 agents. 1 mismatch fixed (Scout model gemini-3-pro → opus). Report: agents/may/workspace/team-audit.md. Completed 2026-03-09.
- [x] **Implement [Agent Evaluation Framework Upgrade]** — Already implemented. Verified 2026-03-23.
- [x] **Implement [Runtime Environment Standardization]** — Already implemented. Verified 2026-03-23.
- [x] **Review + Implement [Detached Sub-Agent Design]** — Phase 1 & 2 complete. Verified 2026-03-23.
- [x] **Review + Implement [Agent Cooperation Design]** — Implemented. Verified 2026-03-23.
- [x] **Implement [Session Simplification]** — Implemented. Verified 2026-03-23.
- [x] **Fix agent identity in heartbeat prompts** — Fixed 2026-03-09.
- [x] **Rolling Compaction (Option C)** — Implemented. Verified 2026-03-23.
- [x] **[ESCALATION] Optimizer corrections blocking graduation** — Applied directly by May 2026-03-23.
- [x] BUG FIX: Add `hasAgent()` to SubagentManager (2026-03-09)
- [x] Review [Remove Evaluator Hardcoded Skip] (2026-03-22)
- [x] Review [Drift Detection: System Design] — Fixed by Bob 2026-03-08
- [x] Review [Tech Lead Agent Design] — Created by Bob 2026-03-09
- [x] Implement [enhance-cron workflow] — Optimizer 2026-03-08
- [x] Review [safe-edit workflow] — Verified 2026-03-08
- [x] Event-Driven Task Completion — Implemented
- [x] Fixed META_AGENTS exclusion (2026-03-22)
- [x] Launcher (2026-03-06, 355724d)
- [x] Session Architecture: Three Types
- [x] Agent cooperation notifications
- [x] philosophy.md restoration
- [x] SOUL.md principle references updated
- [x] Unified Cron System
- [x] Chat Flag & Explicit Session Design
- [x] Philosophy Check — Bob completed
- [x] Watchdog Handler
- [x] Fix: Broken Cron Task Jobs
- [x] Bob Design Reviews
- [x] OpenClaw philosophy import analysis
- [x] XHS Tool Integration
- [x] Proactive autonomy review
- [x] Agent Architecture Alignment
- [x] Human input collection
- [x] Score Distribution Analysis (2026-03-22)
- [x] **Review [Cross-Agent Knowledge Schema]** — APPROVED Phase 1. Reviewed 2026-03-25.
- [x] **Review [Shared Agent Behavior Contract]** — DEFERRED. Reviewed 2026-03-25.
- [x] **Review [Structured Failure Analysis]** — CLOSED. Reviewed 2026-03-25.
- [x] **Review [IPI Defense Patterns]** — APPROVED Layer 2. Reviewed 2026-03-25.
- [x] **Review [User Input Archive Upgrade]** — APPROVED. Reviewed 2026-03-25.
- [x] **Check optimizer todo completion** — Completed 2026-03-25.
- [x] **Scout research: agent self-improvement loops** — Completed 2026-03-25.
- [x] **Health log cleanup** — All entries 2026-03-06+, none stale. Completed 2026-03-25.
- [x] **Research: structured output best practices** — Scout delivered 8 papers. Report: `agents/scout/workspace/structured-output-research.md`. Completed 2026-03-25.
- [x] **Check Bob exercise status** — Bob FAILED adversity exercise #3 (57%). Streak reset 0/3. Completed 2026-03-25.
- [x] **Fix TSC build errors (20 errors)** — Stale re-exports in index.ts, missing `parameters` in health check tool, missing `extractHallucinatedRelPath`/`isMetaRecursionCommand` functions, wrong import extension in test. Fixed 2026-03-10.
- [x] **Cleanup stale principle references** — Fixed P12→P30/P33, P40→P45 in session-model-simplification.md. Completed 2026-03-10.
</details>

## Stale (closed without action)

- ~~🔴 CRITICAL: Restore src/manager.ts~~ — Was a corruption incident. manager.ts is fully functional now.
- ~~Bug: Agent shrink-write after compaction~~ — Shrink guard removed. B7 addresses root cause.
- ~~SubagentManager status API~~ — Health API implemented.
- ~~Cleanup [Session Simplification] vestigial idle checks~~ — No vestigial code found.
