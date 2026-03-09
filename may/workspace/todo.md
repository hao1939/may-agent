# TODO

## Active


## Backlog (approved designs, not yet started)

- [ ] **Review [Cross-Agent Knowledge Schema]** — Tiered context (Hot/Warm/Cold). Doc: `agents/bob/workspace/knowledge-schema-design.md`.
- [ ] **Review [Shared Agent Behavior Contract]** — Doc: `agents/bob/workspace/behavior-contract-design.md`.
- [ ] **Review [Structured Failure Analysis]** — MAST failure codes. Doc: `agents/bob/workspace/failure-analysis-design.md`.
- [ ] **Review [IPI Defense Patterns]** — Doc: `agents/bob/workspace/ipi-defense-design.md`.
- [ ] **Review [User Input Archive Upgrade]** — Structured JSONL. Doc: `agents/bob/workspace/user-input-archive-review.md`.
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

- [x] **Implement [Agent Evaluation Framework Upgrade]** — Already implemented. `agents/evaluator/knowledge/criteria.md` and `agents/evaluator/DOMAIN.md` both exist with role-specific criteria. Verified 2026-03-23.
- [x] **Implement [Runtime Environment Standardization]** — Already implemented in `src/manager.ts` lines 318-354. Project root, container constraints, workspace paths all injected into system prompt. Verified 2026-03-23.
- [x] **Review + Implement [Detached Sub-Agent Design]** — Phase 1 & 2 complete. `src/detached.ts`, `src/socket-client.ts` implemented. `mode` param wired in `manager.ts`. Run/cancel/steer all work for detached sessions. Verified 2026-03-23.
- [x] **Review + Implement [Agent Cooperation Design]** — `parentSessionId` notification implemented in `manager.ts` handleCompletion. Verified 2026-03-23.
- [x] **Implement [Session Simplification]** — `autoClose` field replaces `persistent`. Fully implemented in `manager.ts`. Bob approved 2026-03-08. Verified 2026-03-23.
- [x] **Fix agent identity in heartbeat prompts** — Updated all heartbeat cron prompts to include explicit agent name and path prefix (e.g., "You are Scout. Your files are in agents/scout/."). Fixed 2026-03-09.
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
- ~~Cleanup [Session Simplification] vestigial idle checks~~ — No vestigial code found; autoClose model is clean.
