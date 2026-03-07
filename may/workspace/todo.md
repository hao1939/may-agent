# TODO


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
- [2026-03-06] ✅ Proactive autonomy review — audited all agents. amy, scout, amy-kimi had todo.md but no drain-todo cron. Added amy-drain-todo, scout-drain-todo, amy-kimi-drain-todo (all 8h intervals). Task-based agents (coder, evaluator, qa, master) confirmed no ongoing work — no cron needed.

---

## Human Input Pattern Review — 2026-03-05 (review #2, 1824 lines analyzed)

### Pattern 1: "Verify it works" / "Make sure it works" (30+ occurrences)
User consistently demands proof-of-correctness after every change: "Prove it", "verify your fix works", "run tests and tell me how many pass", "please try each cron job and make sure it works", "double check". This is the single strongest recurring preference.
- **Actionable:** Every implement-and-review cycle MUST include a verification step (run tests, tsc, or manual exercise). No change is done until verified. Codify in workflow definitions if not already enforced.

### Pattern 2: "Don't write code — delegate" / Role discipline (20+ occurrences)
User repeatedly corrects May for writing code directly: "You are a project manager — delegate to coder", "you do NOT write code, you do NOT use the write tool on source files", "delegate to coder via workflow". Same correction for Bob trying to run shell commands instead of using subagents tool.
- **Actionable:** Reinforce in May's domain.md and Bob's domain.md: explicit anti-patterns section listing what each agent must NOT do.

### Pattern 3: Cron job management & conventions (87 mentions)
Cron is the most-discussed topic. User repeatedly: asks to list cron jobs, verify they work, ensure they follow conventions, add descriptions, check for overlapping jobs, make them follow a standard JSON schema.
- **Actionable:** Ensure all cron jobs are defined in `agents/*/cron.json` and follow the schema.

### Pattern 4: "Fix the root cause" (15 occurrences)
User pushes back on band-aid fixes. "Don't just restart it, why did it crash?", "fix the race condition, don't just catch the error".
- **Actionable:** When diagnosing, always identify the root cause before proposing a fix.

### Pattern 5: "Keep it simple" (12 occurrences)
User rejects over-engineered solutions. "Just use a file", "don't add a database", "keep it in one file".
- **Actionable:** Default to file-based state and simple scripts unless complexity is strictly necessary.

### Pattern 6: "Don't guess" (10 occurrences)
User corrects agents for guessing paths or file contents. "Check if the file exists first", "read the file before writing".
- **Actionable:** Always verify state before acting. `read` before `write`. `ls` before `cat`.

### Pattern 7: Git hygiene (8 occurrences)
User expects clean commits and working directories. "Don't leave uncommitted changes", "commit your work".
- **Actionable:** Ensure workflows include commit steps.

### Pattern 8: "Use the tools" (8 occurrences)
User corrects agents for manual work when a tool exists. "Use the test tool", "use the lint tool".
- **Actionable:** Check available tools before inventing manual steps.

### Pattern 9: Workspace discipline (5 occurrences)
User corrects agents for writing outside their workspace. "Don't write to root", "keep your files in your workspace".
- **Actionable:** Enforce workspace isolation.

# Tracking (review #3)

- [2026-03-06] ✅ Third human-inputs review completed. 1836 lines analyzed (+12 since last review). 4 new patterns identified: briefings/observability demand (HIGH), cron reliability skepticism (HIGH), env/config isolation (MEDIUM), hot reload expectations (LOW). 2 existing patterns intensified: cron-as-control-plane and todo-driven-autonomy. 4 new unaddressed ideas flagged.

---

## Human Input Pattern Review — 2026-03-06 (review #4, 1983 lines analyzed, +147 lines since review #3)

**Delta since review #3:** 147 new inputs covering a dense design session.

### NEW Pattern 15: Session Architecture as Infrastructure Priority (19 mentions)
User drove the 3-archetype session design (Chat/Heartbeat/Task) to completion in a single session. Key decisions:
- Main instance holds chat + heartbeats; spawns dedicated instances for cron task jobs
- Each instance is self-contained with identity.json (pid, owner, socket path)
- `--task` mode: agent runs to completion, exits, no stdin/socket/telegram
- Already implemented and committed (bf7aa7f, 78e1039, 9fdb3f9)
- **Status:** IMPLEMENTED ✅

### NEW Pattern 16: Heartbeat ≠ Cron — Distinct Purposes (19 mentions)
User clarified the distinction repeatedly:
- **Heartbeat** = needs LLM power, exploration/reflection, mission-driven
- **Cron job** = proved mechanical process, runs reliably, audited regularly
- Heartbeat can trigger cron jobs when agent finds something worth automating
- Heartbeat is built into main process, doesn't need --cron flag
- **Status:** Captured in design-heartbeat-mission-loop.md ✅

### NEW Pattern 17: Philosophy as Living Architecture (12 mentions)
User drove major philosophy.md restructuring:
- Cluster principles by owner agent (7 sections A-G)
- Merge overlapping principles, add missing ones
- Added Context Isolation (P38), Skills vs Agents (P39)
- Result: 40 principles, each agent gets relevant subset in SOUL.md
- **Status:** IMPLEMENTED ✅

### NEW Pattern 18: External Code Review Relay (9 mentions)
User runs Claude Code reviews on uncommitted changes, then relays feedback:
- Expects agents to evaluate and act on feedback
- Will override: "Poisoned Path Write Guard should be removed"
- Health API got 6 review items; compaction tuning reviewed
- **Actionable:** When user relays code review, treat as high-priority directive. Act immediately.

### Tracking (review #4)
- [2026-03-06] ✅ Fourth human-inputs review completed. 1983 lines (+147). 4 new patterns. Most new inputs are from design sessions already implemented (session architecture, heartbeat design, philosophy restructuring, SOUL.md).

### Heartbeat Cycle — 2026-03-06T08:30Z
**Section 1 (System Audit):** ✅ Disk 41% (142G free), Memory 4.7G/31G, tsc clean, 956/962 tests pass (6 pre-existing failures)
**Section 2 (Human Inputs):** ✅ Reviewed 147 new lines. 4 new patterns extracted (session architecture, heartbeat vs cron, philosophy as architecture, code review relay). All already implemented.
**Section 3 (TODO Drain):**
- ✅ Bob: Weekly Synthesis Brief — template + first brief (2026-W10) produced. Evidence: agents/bob/workspace/weekly-brief-template.md (56 lines), agents/bob/workspace/weekly-briefs/2026-W10.md (58 lines)
- ✅ Coach: Amy coaching exercise — Amy did test exploration cycle, Coach evaluated. Evidence: agents/coach/workspace/amy-coaching-results.md (223 lines), agents/amy/workspace/exploration-log.md (131 lines)
- ✅ Optimizer: CONVENTIONS.md completion evidence convention — added at line 189. Evidence: agents/CONVENTIONS.md updated, agents/optimizer/workspace/todo.md updated.
- ✅ Optimizer: Marked health API TODO as done (was already implemented in manager.ts).
**Section 4 (Mission Reflection):** ✅ Routing correct. No agents overwhelmed. Slow path appropriate for cognitive tasks.
**Section 5 (Exploration):** Skipped — only 2.5h since last (need 8h).

- [2026-03-06] ✅ **Agent-owned cron handlers with auto-discovery**: Moved handler files from `run/handlers/` to `agents/may/handlers/` (system-status, evaluate-sessions, drain-todo, daily-brief). Added `loadAgentHandlers()` in agent-loader.ts that auto-discovers handler files from `agents/<name>/handlers/`, imports them, calls `create(ctx, entry)`, and registers with cron. Removed 50+ lines of hardcoded handler registration from may.ts. Handler files follow `HandlerModule` interface from `run/handler-context.ts`. Config via `handlerConfig` in cron.json entries. Clean compile, all 89 handler/cron tests pass.

- [2026-03-06] ✅ **XHS Browse Tool — Full Rewrite**: Rewrote `agents/amy/tools/xhs-browse.mjs` (366 lines) with proper CDP-based browsing. Key fixes: (1) Extract `xsec_token` from visible anchor elements (`a.cover[href*=\"xsec_token\"]`), (2) Open notes in new tabs for proper rendering, (3) Deduplicated comments using `.parent-comment` with `isReply` flags, (4) Deduplicated images by URL path, (5) Proper engagement extraction from wrapper elements, (6) Video and image note types both supported. All 3 commands verified working: feed (17 items), search (16 items), read (full structured extraction). Status doc: `agents/bob/workspace/xhs-tool-status.md`.

- [2026-03-06] ✅ **Watchdog Handler — Stale Session Detection & Cancellation**: Created `agents/may/handlers/watchdog.ts` (120 lines) as a JS cron handler that runs every 10 minutes. Detects sessions stuck in \"running\" state beyond their timeout threshold (default 30min, per-agent overrides for evaluator/optimizer/bob/coach at 45min). Cancels stale sessions via `manager.cancel()`. Warns about sessions at >75% of timeout. May's persistent session is excluded. Also enhanced `system-status.ts` handler to flag stale sessions as anomalies in health reports. Added watchdog entry to `cron.json` (600,000ms interval). Verified: logic correct via functional test, tsc clean, no new errors.

- [2026-03-07] ✅ **Fix: Broken Cron Task Jobs → run-agent-task Handler**: Created `agents/may/handlers/run-agent-task.ts` — generic handler that spawns agent sessions via `manager.run()` with timeout protection and cancellation. Fixed 5 broken cron jobs (analyze-failures, optimize, health-check, coaching, lesson-consolidation) that used `fireTask()` which called nonexistent `may.sh task`. Also fixed disabled philosophy-check. All 6 jobs now have `\"handler\": \"run-agent-task\"` in cron.json, routing them through the JS handler path instead of the broken subprocess path. Handler supports `waitForCompletion` (default true) with configurable `timeoutMs` (default 30min). Design doc: `agents/may/workspace/delegation-architecture-proposal.md`.

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

- [ ] **Review [Tech Lead Agent Design]** and implement if approved.
  - Context: Bob drafted the design for a dev-leader agent.
  - Doc: agents/bob/workspace/dev-leader-design.md
  - Implementation: Create agents/tech-lead/agent.json and knowledge/ files.

- [ ] **Review [Agent Cooperation Design]** and implement if approved.
  - Context: Bob approved the design for Task Completion Notifications.
  - Doc: agents/bob/workspace/agent-cooperation-review.md
  - Implementation: Update run-agent-task.ts and drain-todo.ts to set parentSessionId.

- [ ] **Implement [enhance-cron workflow]**
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

- [2026-03-09] ✅ **F3: Score-Reactive Coaching Trigger — Fixed** — Root cause: `may.ts` auto-evaluates sessions on completion (line 148, `onSessionComplete` callback) but this path had NO coaching trigger. The cron handler `evaluate-sessions.ts` had the trigger but never found unevaluated sessions (already evaluated by may.ts). Fix: Added coaching trigger to `run/may.ts` auto-evaluation path — writes to `agents/coach/workspace/todo.md` via `appendToTodoSection` and calls `triggerNow("heartbeat-coach")` when verdict is "needs_improvement". Both paths now trigger coaching.
