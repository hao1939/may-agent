# TODO

## Active

- [ ] **Review [Detached Sub-Agent Design]** — Bob approved v2. Doc: `agents/bob/workspace/detached-subagent-review.md`. Phase 1: `src/detached.ts`, socket client, manager updates.
- [ ] **Review [Agent Cooperation Design]** — Doc: `agents/bob/workspace/agent-cooperation-review.md`. Update `run-agent-task.ts` and `drain-todo.ts` for parentSessionId.
- [ ] **Implement [Session Simplification]** — Bob approved 2026-03-08. Design: `agents/shared/session-model-simplification.md`.
- [ ] **Fix agent identity in heartbeat prompts** — Agents can't determine own identity from generic heartbeat. Include explicit agent name + paths. Affects: amy, optimizer, potentially all. Coach report: `agents/coach/workspace/sessions/amy-identity-exercise-2026-03-22.md`.
- [ ] **Review [Agent Evaluation Framework Upgrade]** — Role-specific criteria. Doc: `agents/bob/workspace/agent-evaluation-review.md`.

## Backlog (approved designs, not yet started)

- [ ] **Implement [Runtime Environment Standardization]** — Standardize on `/app`. Doc: `agents/shared/workflow-proposals/runtime-env-standardization.md`.
- [ ] **Review [Cross-Agent Knowledge Schema]** — Tiered context (Hot/Warm/Cold). Doc: `agents/bob/workspace/knowledge-schema-design.md`.
- [ ] **Review [Shared Agent Behavior Contract]** — Doc: `agents/bob/workspace/behavior-contract-design.md`.
- [ ] **Review [Structured Failure Analysis]** — MAST failure codes. Doc: `agents/bob/workspace/failure-analysis-design.md`.
- [ ] **Review [IPI Defense Patterns]** — Doc: `agents/bob/workspace/ipi-defense-design.md`.
- [ ] **Review [User Input Archive Upgrade]** — Structured JSONL. Doc: `agents/bob/workspace/user-input-archive-review.md`.
- [ ] **Cleanup [Session Simplification]** — Remove vestigial idle checks for task sessions in manager.ts.
- [ ] **Cleanup stale principle references** — session-model-simplification.md cites wrong P-numbers. Low priority. See: `agents/bob/workspace/drift-detection-2026-03-09.md`.

## Ideas (need investigation)

- [ ] **Auto-commit after QA approval** — Add commit step to `implement-and-review` workflow.
- [ ] **Cross-Agent Knowledge Schema** — OC-style Hot/Warm/Cold tiered knowledge. Source: `/home/hao/openclaw-config/knowledge/SCHEMA.md`.
- [ ] **SIGNALS.md pattern** — Lightweight cross-agent communication. Source: `/home/hao/openclaw-config/SIGNALS.md`.
- [ ] **Weekly Briefs** — Bob produces periodic synthesis reports. Source: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`.
- [ ] **Issue Detection Pipeline** — JS port of OC's `detect.py`. Structured signal reports.

# Archive

<details>
<summary>Completed items (click to expand)</summary>

- [x] **Rolling Compaction (Option C)** — Already implemented. `compactIdleSession` in manager.ts (line 560-574), called from handleCompletion (line 628). QA PASS. Verified 2026-03-23.
- [x] **[ESCALATION] Optimizer corrections blocking graduation** — Applied directly by May 2026-03-23:
  - Scout coaching corrections #11-13 added to `agents/scout/knowledge/coaching.md`
  - Scout DOMAIN.md paths fixed (all `knowledge/` → `agents/scout/knowledge/`)
  - Coder `agents/coder/knowledge/lessons.md` created with pattern-sed rules, side-by-side examples, multi-edit guidance
- [x] BUG FIX: Add `hasAgent()` to SubagentManager (2026-03-09)
- [x] Review [Remove Evaluator Hardcoded Skip] (2026-03-22)
- [x] Review [Drift Detection: System Design] — Fixed by Bob 2026-03-08
- [x] Review [Tech Lead Agent Design] — Created by Bob 2026-03-09
- [x] Implement [enhance-cron workflow] — Optimizer 2026-03-08
- [x] Review [safe-edit workflow] — Verified 2026-03-08
- [x] Event-Driven Task Completion — Implemented
- [x] Fixed META_AGENTS exclusion (2026-03-22)
- [x] Launcher (2026-03-06, 355724d)
- [x] Session Architecture: Three Types (bf7aa7f, 78e1039, 9fdb3f9)
- [x] Agent cooperation notifications — manager.ts handleCompletion
- [x] philosophy.md restoration (278 lines, P0-P39)
- [x] SOUL.md principle references updated
- [x] Unified Cron System (785a273)
- [x] Chat Flag & Explicit Session Design
- [x] Philosophy Check — Bob completed, 2 drifts found
- [x] Watchdog Handler — stale session detection
- [x] Fix: Broken Cron Task Jobs → run-agent-task handler
- [x] Bob Design Reviews — Rolling Compaction + Detached Sub-Agent approved
- [x] OpenClaw philosophy import analysis — Bob completed
- [x] XHS Tool Integration — all 3 commands working
- [x] Proactive autonomy review — all agents have heartbeat + drain-todo
- [x] Agent Architecture Alignment — configs standardized
- [x] Human input collection (069ec3d)
- [x] Score Distribution Analysis (2026-03-22)

</details>

## Stale (closed without action)

- ~~🔴 CRITICAL: Restore src/manager.ts~~ — Was a corruption incident. manager.ts is fully functional now.
- ~~Bug: Agent shrink-write after compaction~~ — Shrink guard removed. B7 (read before overwrite) addresses root cause.
- ~~SubagentManager status API~~ — Health API implemented.
