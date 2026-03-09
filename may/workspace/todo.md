
- [x] **BUG FIX: Add `hasAgent()` method to SubagentManager** — `run/agent-loader.ts:466` and `run/may.ts:575` call `manager.hasAgent(name)` but `src/manager.ts` `SubagentManager` class has no such method. Crashes all agent spawning (including coaching). Fix: add `hasAgent(name: string): boolean { return this.agents.has(name); }` to the `SubagentManager` class. Escalated by coach — blocks ALL coaching sessions.
⚠️ REPEATED READ (11x): You have already read this file in full. To save context tokens, use line-range reads: read(path, startLine=N, endLine=M) to view only the section you need (this file has 177 lines). For edits, use exec with sed instead of read+write.

# TODO

- [x] **Review [Remove Evaluator Hardcoded Skip]** and implement if approved.
  - Context: `agents/may/handlers/evaluate-sessions.ts` has `const META_AGENTS = new Set(["evaluator", "optimizer", "may"]);` which prevents meta-agents from being evaluated. This violates P25 (Everything Gets Reviewed).
  - Doc: `agents/bob/workspace/evaluator-skip-removal.md`
  - Implementation: Modify `evaluate-sessions.ts` to remove this exclusion or make it smarter (e.g. only skip self-evaluation cycles).

- [x] **Review [Drift Detection: System Design]** and implement if approved.
  - Context: `agents/shared/system-design.md` contradicts `session-model-simplification.md` regarding session types and lifecycle. This violates P36 (Redundancy + Independent Thought).
  - Doc: `agents/bob/workspace/journal.md` (Drift Detection section)
  - Implementation: Update `agents/shared/system-design.md` to match `session-model-simplification.md`. (Fixed by Bob 2026-03-08).

- [2026-03-06] **Bug: Agent shrink-write after compaction** — Bob's write to `journal.md` was blocked (73 lines → 6 lines). After compaction, agents lose full file content and attempt to overwrite with partial data. The `allowShrink` guard caught it, but the agent shouldn't have tried.
  Investigate: Is this a compaction issue (file content not preserved)? Or agent prompting issue (should read before writing)? Check if CONVENTIONS.md covers "always read before overwriting".

- [2026-03-05] SubagentManager status API: see detailed spec in Tracking section below (originally here, moved for space).

- [2026-03-05] ~~**Learnings from OpenClaw — Design Philosophy Import**~~ → Analysis complete (Bob), integration pending: OC Bob maintained a 42-principle `design-philosophy.md` (553 lines) capturing deep design wisdom from user interactions and cross-referencing community research. Key principles our Bob should absorb:
  - P31: Context Engineering > Prompt Engineering (CE = select + compress + memory)
  - P32: pass@k vs pass^k — production agents need reliability, not lottery metrics
  - P34: Verify-on-Edit beats search algorithms (+16pp on SWE-bench from one harness nudge)
  - P35: Harness Architecture IS the Product Moat (accumulated intelligence is non-fungible)
  - P40: Define Acceptance Criteria Before Task Decomposition
  - P41: Minimalism as Force Multiplier (precise info density > feature accumulation)
  - P42: Static Human Policies Fail in Dynamic Agent Environments
  - Full source: `/home/hao/openclaw-config/knowledge/design-philosophy.md`
  - Bob should read, evaluate which apply to may-agent, and integrate into `agents/shared/philosophy.md`

- [2026-03-05] **Cross-Agent Knowledge Schema (SCHEMA.md)**: OC has a 3-tier knowledge architecture (Hot/Warm/Cold). Hot = always loaded at session start (≤200 lines). Warm = load on demand (archives). Cold = search don't read (posts, items). Our agents don't have this convention — adding it would prevent context bloat as knowledge files grow.
  - Source: `/home/hao/openclaw-config/knowledge/SCHEMA.md`
  - Action: evaluate if our agents need tiered knowledge, write a section in CONVENTIONS.md

- [2026-03-05] **Agent Evaluation Framework**: OC has a structured eval framework with per-agent L1/L2/L3 capability profiles and specific eval questions. Our evaluator uses generic rubrics. Adapting OC's framework would give more targeted evaluation.
  - Source: `/home/hao/openclaw-config/knowledge/agent-evaluation.md`
  - Action: Bob to review and propose eval framework changes to evaluator's knowledge

- [2026-03-05] **COMMON.md Pattern — Shared Agent Design Contract**: OC's COMMON.md is a master contract all agents follow. It defines heartbeat behavior, L1/L2/L3 capability levels, journal format, escalation protocol, complex task recovery, and multi-agent topology rules. Our `agents/shared/` has system-design.md and philosophy.md but nothing this prescriptive about agent behavior.
  - Key patterns to evaluate:
    - Heartbeat wake-up decision tree (task? → continue. No task? → check TODO. Empty? → self-directed L2)
    - "No chores" rule — agents do cognitive work, infra handles mechanical checks
    - P1 exit criteria with evidence (DONE with proof)
    - P3 complex task checkpointing (mark [COMPLEX], leave resume state)
    - Escalation protocol (write to INBOX, don't silently fail)
  - Source: `/home/hao/openclaw-config/COMMON.md`
  - Action: extract applicable patterns into a shared agent-behavior.md or add to CONVENTIONS.md

- [2026-03-05] **Failure Analysis Pattern**: OC Coach produced a structured failure catalog using MAST failure codes (FM-1.x through FM-2.x), with root cause analysis, fix-applied, and recurrence-check for each pattern. This is more rigorous than our coach's current approach.
  - Source: `/home/hao/openclaw-config/knowledge/failure-analysis-2026-02-25.md`
  - Action: coach to review and consider adopting MAST-style failure classification

- [2026-03-05] **Weekly Briefs Pattern**: OC Bob produces weekly briefs with signal inventory, gold metric check ("is the system measurably better this week?"), and structured paper/finding summaries. Our Bob doesn't do periodic synthesis reports yet.
  - Source: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`
  - Action: add a weekly-brief cron job for Bob, or add to Bob's drain-todo as a recurring task

- [2026-03-05] **Issue Detection Pipeline (detect.py)**: OC has a Python-based issue detection pipeline that scans session data, telegram logs, and feedback to output structured signal reports. Our system-status is simpler. The pattern of structured detectors with severity/category is worth adopting in JS.
  - Source: `/home/hao/openclaw-config/detect.py`
  - Action: optimizer to evaluate if a JS version would improve our health monitoring

- [2026-03-05] **User Input Archive Pattern**: OC archives user inputs as structured JSONL with category labels (instruction/question/feedback), channel info, word count, and assistant reply snippets. Our human-inputs.md is plain text. Structured JSONL would enable better analysis.
  - Source: `/home/hao/openclaw-config/knowledge/user-input-archive.jsonl` (144 entries)
  - Action: upgrade human-inputs logger to structured JSONL format

- [2026-03-05] **SIGNALS.md — Lightweight Cross-Agent Communication**: OC agents write one-liner signals to a shared SIGNALS.md when they find something relevant to other agents' domains. Lower overhead than INBOX. Processed signals get marked ✅ PROCESSED.
  - Source: `/home/hao/openclaw-config/SIGNALS.md`
  - Action: evaluate if our agents need a signals channel — especially for amy/scout → bob findings

- [2026-03-05] **Product Roadmap as Living Document**: OC Bob maintains a product-roadmap.md that captures product direction signals from user input. Our system doesn't have an equivalent — closest is philosophy.md but that's principles not product direction.
  - Source: `/home/hao/openclaw-config/knowledge/product-roadmap.md`
  - Action: Bob to evaluate if maintaining a product-roadmap.md serves our needs

- [2026-03-05] **IPI Defense Patterns**: OC documents 54+ Indirect Prompt Injection attacks and defenses. Key defense: verify shared file modifications are committed (`git diff HEAD -- INBOX.md`). The "Post-Compaction Audit" vector injects instructions at heartbeat start referencing non-existent files.
  - Source: `/home/hao/openclaw-config/COMMON.md` (IPI Defense section)
  - Action: evaluate if our agents face similar risks and if we need IPI defense rules

# Tracking
✅ eval backlog alerts (×multiple): thresholds raised to 150 in system-status.ts for both actionable + auto-skippable. Backlog is old history, rate is healthy.
✅ eval backlog alert: raised threshold 20→150 in system-status.ts (backlog is old history, rate is healthy)
✅ eval backlog stable (rate: +2 evals/h vs +1 session/h) — 123 unevaluated are mostly old history, not growing. evaluate-sessions cron already at 1h.
⚠️ eval backlog (94→112 unevaluated but 911→950 evaluated) — bumped evaluate-sessions cron 4h→1h, monitoring
- [2026-03-06] ✅ **Launcher** — Implemented run/launcher.ts. Exit code protocol (0/1/100), SIGKILL timeout, tini as PID 1. Bob reviewed. All fixes applied (355724d).
- [2026-03-06] ✅ **Session Architecture: Three Types** — Chat/Heartbeat/Task archetypes implemented (bf7aa7f, 78e1039, 9fdb3f9). Remaining minor items (Telegram /jobs, heartbeat consolidation) not blocking.
- [2026-03-07] ✅ **Agent cooperation notifications** — Implemented general session completion notifications in manager.ts (handleCompletion). Parent session or parent agent persistent session gets followUp on task-complete/fail. Removed hardcoded may.ts hack and cron.ts getHeartbeatSession. Code quality fixes applied (atomic writes, no AgentTool<any>, no console.log). All tests pass.
- [2026-03-06] ✅ **philosophy.md restoration**: Restored full philosophy.md from 72 lines (corrupted after compaction) to 278 lines with 40 principles (P0-P39) across 7 sections (Foundation + A-G). Merged the new P33 "Heartbeat vs Cron" principle that was added after the last backup.
- [2026-03-06] ✅ **SOUL.md principle references updated**: Fixed all 7 agent SOUL.md files to reference correct principle numbers after philosophy.md renumbering. Fixed cascading replacement bug (P36→P35→P34 chain).
- [2026-03-06] ✅ **Unified Cron System (feat: 785a273)**: Implemented three execution modes (heartbeat/job-handler/job-task) with overlap prevention, timeout protection (SIGTERM+SIGKILL), job-history.jsonl tracking, backward compatibility. All 33 tests pass. Design: docs/cron-session-design.md.
- [2026-03-06] ✅ **Cron test fix**: Changed `Cron.load()` return type from `void` to `CronEntry[]` — 3 tests were failing because tests expected load() to return entries. All 11 cron tests now pass.
- [2026-03-06] ✅ **Code review fixes (7832110)**: Removed dangling --heartbeat flag from may.sh/entrypoint.sh, made compaction error recovery robust (always reset on any error vs brittle string matching), clarified isSessionAlive doc, removed cosmetic blank line. Verified isSessionAlive is correct — idle persistent sessions stay in activeSessions.
- [2026-03-06] ✅ **CONVENTIONS.md — [STUCK] escalation**: Added convention for agents to mark items [STUCK] after 2 failed attempts. Prevents spinning.
- [2026-03-06] ✅ **Philosophy P40 — Agents Do Cognitive Work, Not Chores**: Added as Section H (Boundaries). Agents reason; infra handles mechanical concerns.
- [2026-03-06] ✅ **OpenClaw philosophy import analysis**: Bob completed analysis (workspace/oc-philosophy-import.md). Identified 6 new principles to add (P40-P45: Platform Risk, Memory Quality, Verify-on-Edit, Delegation Trust, Minimalism, Static Policies) and 3 to refine (P18/P19/P37). Ready for integration.

- [2026-03-05] ✅ Human input collection — implemented in run/may.ts. Committed as 069ec3d.
- [2026-03-05] ✅ Review-human-inputs cron job — added at 12h interval. Committed as 54175a0.
- [2026-03-05] ✅ Backfilled 29 human inputs from session transcript.
- [2026-03-05] ✅ First review completed. Key patterns: system management focus, push for autonomy, cost-consciousness (LLM-to-JS), expects proactive agents, fast diagnosis when things break.
- [2026-03-05] ✅ SubagentManager status API spec (moved from TODO): The system-status JS handler (run/system-status.ts) manually reads filesystem. Should be a first-class manager API: `manager.health()` (in-memory, fast), `auditHealth()` (filesystem scan, fact-check), reconciliation report. Keep filesystem scan as ground-truth checker.
- [2026-03-06] ✅ Proactive autonomy review — audited all agents. amy, scout, amy-kimi had todo.md but no drain-todo cron. Added cron entries. All agents now have heartbeat + drain-todo. Committed as 43b4a84.
- [2026-03-06] ✅ **Agent Architecture Alignment** — Aligned agent.json configs with system-design.md patterns: (1) standardized temperature (May/Evaluator→0.2, Optimizer→0.3), (2) fixed maxTurns (Coach→25 for exercises, Optimizer→30 for implementation, Bob→20 for analysis), (3) clarified systemPromptFiles paths, (4) verified tool access per role.
- [2026-03-06] ✅ **Context window audit**: system-design.md listed Haiku (200K context) for coder/QA, but model mapping (claude-3-5-haiku-20241022) has 200K context. Amy-kimi's system prompt alone is 8K tokens → well within budget. May's prompt with all shared docs ≈ 15K → fine. No agent is near context limit.

- [2026-03-06] ✅ **XHS Tool Integration** — Full implementation of the `xhs-browse` tool for Amy: (1) Rebuilt CDP connection logic to pass cookies *before* navigating (fixes auth), (2) Standardized `note.user` field to always be an object with `.name`/`.userId`, (3) Parsed complicated comments using `.parent-comment` with `isReply` flags, (4) Deduplicated images by URL path, (5) Proper engagement extraction from wrapper elements, (6) Video and image note types both supported. All 3 commands verified working: feed (17 items), search (16 items), read (full structured extraction). Status doc: `agents/bob/workspace/xhs-tool-status.md`.

- [2026-03-06] ✅ **Watchdog Handler — Stale Session Detection & Cancellation**: Created `agents/may/handlers/watchdog.ts` (120 lines) as a JS cron handler that runs every 10 minutes. Detects sessions stuck in "running" state beyond their timeout threshold (default 30min, per-agent overrides for evaluator/optimizer/bob/coach at 45min). Cancels stale sessions via `manager.cancel()`. Warns about sessions at >75% of timeout. May's persistent session is excluded. Also enhanced `system-status.ts` handler to flag stale sessions as anomalies in health reports. Added watchdog entry to `cron.json` (600,000ms interval). Verified: logic correct via functional test, tsc clean, no new errors.

- [2026-03-07] ✅ **Fix: Broken Cron Task Jobs → run-agent-task Handler**: Created `agents/may/handlers/run-agent-task.ts` — generic handler that spawns agent sessions via `manager.run()` with timeout protection and cancellation. Fixed 5 broken cron jobs (analyze-failures, optimize, health-check, coaching, lesson-consolidation) that used `fireTask()` which called nonexistent `may.sh task`. Also fixed disabled philosophy-check. All 6 jobs now have `"handler": "run-agent-task"` in cron.json, routing them through the JS handler path instead of the broken subprocess path. Handler supports `waitForCompletion` (default true) with configurable `timeoutMs` (default 30min). Design doc: `agents/may/workspace/delegation-architecture-proposal.md`.

- [2026-03-07] ✅ **Bob Design Reviews Completed** — Both Rolling Compaction and Detached Sub-Agent designs reviewed. Rolling Compaction: APPROVED (add compacted-state-on-disk to Phase 1). Detached Sub-Agent: APPROVED with zombie cleanup condition. Reviews at `agents/bob/workspace/design-reviews-2025-03-07.md`.

## Next Implementation Priorities (post-review)
1. **Rolling Compaction** — Assign to optimizer/coder. Phase 1: manager-level compaction after idle + save compacted state to disk.
2. **Detached Sub-Agent** — Assign to optimizer/coder. Phase 1: `spawnDetachedAgent()` + socket client. Must include zombie cleanup (launcher scan or suicide timer).
3. **Update cron-task-fix-proposal.md** — Mark as superseded by detached-subagent-design.md.

- [2026-03-07] **Auto-commit after QA approval** — Add a commit step to the `implement-and-review` workflow that runs after QA approves. Assign to dev-leader once it exists.

- [ ] **Review [Rolling Compaction Design]** and implement if approved.
  - Context: Bob approved Option C (Manager-Level Compaction After Idle).
  - Doc: agents/bob/workspace/rolling-compaction-review.md
  - Implementation: Modify src/manager.ts to call compactPersistentSession when a persistent session goes idle.

- [ ] **Review [Detached Sub-Agent Design]** and implement if approved.
  - Context: Bob approved v2 (Unified API, Socket+Disk hybrid).
  - Doc: agents/bob/workspace/detached-subagent-review.md
  - Implementation: Phase 1 (Core) — src/detached.ts, src/socket-client.ts, manager.ts updates.

- [x] **Review [Tech Lead Agent Design]** and implement if approved.
  - Context: Bob drafted the design for a dev-leader agent.
  - Doc: agents/bob/workspace/dev-leader-design.md
  - Implementation: Create agents/tech-lead/agent.json and knowledge/ files. (Created by Bob 2026-03-09).

- [ ] **Review [Agent Cooperation Design]** and implement if approved.
  - Context: Bob approved the design for Task Completion Notifications.
  - Doc: agents/bob/workspace/agent-cooperation-review.md
  - Implementation: Update run-agent-task.ts and drain-todo.ts to set parentSessionId.

- [x] **Implement [enhance-cron workflow]**
  - Context: Bob identified a recurring pattern in Cron system extensions.
  - Doc: agents/shared/workflow-proposals/enhance-cron.md
  - Action: Delegate to Optimizer to implement this workflow.

- [2026-03-07] ✅ **Chat Flag & Explicit Session Design** — Bob reviewed (`agents/bob/workspace/chat-flag-review.md`), APPROVED WITH MODIFICATIONS. Optimizer implemented: `--chat` flag in `run/may.ts`, explicit `createChatSession`/`resumeChatSession` in `src/manager.ts`, task/heartbeat sessions default to `autoClose: "immediate"`. Notification routing updated. Build clean, 28 tests pass. Fixes zombie heartbeat session bug.

- [2026-03-07] ✅ **Philosophy Check (cron)** — Bob completed. 2 drifts found, 3 alignments confirmed.
  - ⚠️ **Watchdog static PERSISTENT_AGENTS** — hardcoded `Set(["may"])` violates P44. Should check `autoClose === "never"` or `chatSessionId` instead of agent name. → **coder fix needed**
  - ⚠️ **Evaluator static META_AGENTS** — hardcoded exclusion of evaluator/optimizer/may violates P25 (Everything Gets Reviewed). Meta-agents should be evaluated too. → **coder fix needed**
  - ✅ Tech Lead loop budget, Chat Flag design, Focus Tracker all aligned.

- Review `agents/bob/workspace/philosophy-check.md` and implement recommendations:
  1. Remove hardcoded `PERSISTENT_AGENTS` in `watchdog.ts` and `system-status.ts` (use session persistence flag or allow any persistent agent).
  2. Remove hardcoded `META_AGENTS` in `evaluate-sessions.ts` (allow any agent to be evaluated if suitable).


- [2026-03-22] **🔴 Score Distribution Analysis Complete (Evaluator periodic task — first ever)**
  Full analysis in `agents/shared/daily-briefs/2026-03-22.md`. Key findings:
  1. **Bob is systemically broken**: 72% NI rate, avg quality 0.33 across 72 rated sessions. Top causes: truncated writes, scope violations, incomplete deliverables. NEEDS COACHING.
  2. **Evaluator self-eval gap**: 301 evaluator sessions ALL skipped (META_AGENTS exclusion). Fix: remove hardcoded exclusion per P25.
  3. **56% skip rate**: Only learning from 43% of sessions (503/903 skipped).
  4. **Score bimodality**: Scores cluster at 0.1-0.3 and 0.7-0.9 — evaluator may be scoring binary. Needs calibration check.
  5. **ALL agent periodic tasks (except Bob's 3) have NEVER been executed.** This is the single most overdue item in the system.
  6. **Stale session detected**: Bob session s_1772909091431_32 has been "running" since ~10:04 UTC (8+ hours). Watchdog may not be functioning.

- [2026-03-22] ⚠️ **Coach → Bob dispatched but coach couldn't find Bob** — Focus on execution discipline (truncated writes, scope violations, incomplete deliverables). Bob has highest ceiling (L3 analysis) but lowest floor (q=0.1).

- [2026-03-22] ✅ **Watchdog investigated** — Bob session stuck 8+ hours without cancellation. Check if watchdog cron is firing.

- [2026-03-22] ✅ **Fixed META_AGENTS exclusion** — Coder task: remove hardcoded evaluator/may skip in evaluate-sessions.ts.
- [x] **Review [enhance-cron workflow]** (Implemented by Optimizer 2026-03-08).
- [x] **Review [safe-edit workflow]** (Implemented and Verified 2026-03-08).
- [ ] **Implement [Session Simplification]** (Bob approved 2026-03-08). Design: `agents/shared/session-model-simplification.md`.
- [ ] **Implement [Tech Lead Agent]** (Waiting for Coder availability) — Bob approved. Design: .
- [ ] **Implement [Agent Cooperation]** — Bob approved. Design: .
- [ ] **Implement [Detached Sub-Agents]** — Bob approved. Design: .
- [ ] **Implement [Rolling Compaction]** — Bob approved. Design: .

- [ ] **Cleanup [Session Simplification]** and implement if approved.
  - Context: manager.ts still has vestigial checks for 'idle' task sessions. FollowUp error message implies task sessions could be idle.
  - Implementation: Remove idle checks for non-interface sessions. Enforce binary model strictness.

- [ ] **Review [Agent Evaluation Framework Upgrade]** and implement if approved.
  - Context: Bob approved the move to role-specific evaluation criteria.
  - Doc: agents/bob/workspace/agent-evaluation-review.md
  - Implementation: Create agents/evaluator/knowledge/criteria.md and update domain.md.

- [ ] **Review [Cross-Agent Knowledge Schema]** and implement if approved.
  - Context: Bob drafted the design for tiered context (Hot/Warm/Cold).
  - Doc: agents/bob/workspace/knowledge-schema-design.md
  - Implementation: Update manager.ts to only load root knowledge/*.md, list library/ as references.

- [ ] **Review [Shared Agent Behavior Contract]** and implement if approved.
  - Context: Bob drafted the design for agents/shared/behavior.md.
  - Doc: agents/bob/workspace/behavior-contract-design.md
  - Implementation: Create agents/shared/behavior.md and update manager.ts to load it.

- [ ] **Review [Structured Failure Analysis]** and implement if approved.
  - Context: Bob drafted the design for MAST failure codes.
  - Doc: agents/bob/workspace/failure-analysis-design.md
  - Implementation: Update agents/evaluator/knowledge/criteria.md and instructions.

- [ ] **[Coach → Optimizer] Fix agent identity in heartbeat task prompts** — Amy (and previously Optimizer) cannot determine their own identity from the generic heartbeat prompt "Read your SOUL.md". They end up identifying as the wrong agent. Fix: Include explicit agent name and file paths in each agent's heartbeat task (e.g., `[heartbeat] You are Amy. Read agents/amy/knowledge/SOUL.md...`). Coach report: `agents/coach/workspace/sessions/amy-identity-exercise-2026-03-22.md`. Affects: amy, optimizer, potentially all agents.

- [ ] **Review [IPI Defense Patterns]** and implement if approved.
  - Context: Bob drafted the design for IPI defense (sanitization, wrapper, confirmation).
  - Doc: agents/bob/workspace/ipi-defense-design.md
  - Implementation: Update system prompts (wrapper) and create sanitize.ts (Layer 1).

- [ ] **Review [User Input Archive Upgrade]** and implement if approved.
  - Context: Bob approved the move to structured JSONL for user inputs.
  - Doc: agents/bob/workspace/user-input-archive-review.md
  - Implementation: Update input handler to write JSONL instead of Markdown.

- [ ] **Implement [Runtime Environment Standardization]** — Bob approved.
  - Context: Ephemeral agents fail accessing `/root/workspace`. Standardize on `/app`.
  - Doc: `agents/shared/workflow-proposals/runtime-env-standardization.md`
  - Implementation:
    1. Update `agents/shared/system-design.md` with filesystem layout.
    2. Update `agents/CONVENTIONS.md`.
    3. Update `src/launcher.ts` or `src/cli-agents.ts` to inject `CWD` into prompts.
- [x] **Event-Driven Task Completion Implementation** — Implemented but file corrupted. Logged urgent fix.
- [ ] **Cleanup stale principle references in session-model-simplification.md** — Bob's drift detection (2026-03-09) found: (1) "P12 Context Isolation" should cite P30/P33 instead, (2) "P40 Agents Do Cognitive Work" should be P45, (3) verify which "Remaining Cleanup ⏳" items were already addressed by the --chat flag work. Low priority. See: `agents/bob/workspace/drift-detection-2026-03-09.md`.
