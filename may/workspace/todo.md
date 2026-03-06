# TODO
- [2026-03-06] **Session Architecture: Implement Three Types** — Design finalized in agents/shared/design-ideas.md. Build:
  1. `--task "message"` mode in run/may.ts (task as initial message, exit on done, keep socket)
  2. CronEntry: add `agent` and `sessionType` fields
  3. Cron dispatcher: spawn dedicated instance for task jobs, followUp for heartbeats
  4. Job tracker: `.state/jobs/<name>/status.json`
  5. Telegram: `/jobs` command, completion summaries
  6. Heartbeat: consolidate per-agent cron jobs into single heartbeat.md per agent

- [2026-03-05] SubagentManager status API: see detailed spec in Tracking section below (originally here, moved for space).

- [2026-03-05] **Learnings from OpenClaw — Design Philosophy Import**: OC Bob maintained a 42-principle `design-philosophy.md` (553 lines) capturing deep design wisdom from user interactions and cross-referencing community research. Key principles our Bob should absorb:
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
- [2026-03-06] ✅ **philosophy.md restoration**: Restored full philosophy.md from 72 lines (corrupted after compaction) to 278 lines with 40 principles (P0-P39) across 7 sections (Foundation + A-G). Merged the new P33 "Heartbeat vs Cron" principle that was added after the last backup.
- [2026-03-06] ✅ **SOUL.md principle references updated**: Fixed all 7 agent SOUL.md files to reference correct principle numbers after philosophy.md renumbering. Fixed cascading replacement bug (P36→P35→P34 chain).
- [2026-03-06] ✅ **Cron test fix**: Changed `Cron.load()` return type from `void` to `CronEntry[]` — 3 tests were failing because tests expected load() to return entries. All 11 cron tests now pass.

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
Cron is the most-discussed topic. User repeatedly: asks to list cron jobs, verify they work, ensure they follow conventions, add descriptions, check for overlapping jobs, make them ephemeral. User wants centralized cron management through May.
- **Actionable:** May should have a periodic "cron health audit" that verifies all cron jobs can execute successfully, don't overlap, and follow naming conventions. Consider adding to existing cron job or creating a lightweight audit function.

### Pattern 4: Agent migration from OpenClaw (13 occurrences)
User migrated multiple agents (amy, amy-kimi, bob, scout, coach) from OpenClaw. Each migration follows the same pattern: copy agent + knowledge, coach through setup, verify tools work. User also wants to learn from OC's design patterns.
- **Actionable (DONE for agent migration; remaining):** Extract a repeatable agent-migration checklist (1. copy agent dir, 2. adapt agent.json, 3. migrate knowledge, 4. coach/verify tools, 5. add cron jobs). Save to CONVENTIONS.md or agents/shared/.

### Pattern 5: Efficiency / cost consciousness (34 mentions)
User tracks efficiency metrics (0.60→0.15 decline, 0.63 avg, 0.38 avg), demands optimization cycles, flags cost blowouts ($6-11 sessions), wants LLM-to-JS replacements for mechanical tasks.
- **Actionable:** The LLM-to-JS audit pattern should be a standing item. Optimizer already has this in its todo. Ensure the optimizer's drain-todo cron fires and actually processes items.

### Pattern 6: Turn budget / context overflow (33 mentions)
Agents repeatedly hit turn limits and context overflow. User added turn budget warnings, rich context persistence for overflow recovery, maxTurns feature. Still a recurring problem.
- **Actionable:** Monitor which agents hit budget most frequently. If an agent consistently hits 80% budget on simple tasks, its domain.md or knowledge files may be too large (context bloat). Cross-reference with Pattern 8 (knowledge tiering).

### Pattern 7: Git hygiene — commit promptly (78 mentions of git operations)
User frequently: asks to commit changes, checks git status, discovers uncommitted work from crashed/cancelled sessions, has to manually run `git checkout -- .` to clean up. Multiple instances of "the staged changes need to be committed", "there are uncommitted changes".
- **Actionable:** After every successful implement-and-review cycle, the workflow should auto-commit (or at minimum, the final step should be a commit prompt). Also: crashed sessions should trigger a git stash or checkpoint.

### Pattern 8: Unified input channels (4+ occurrences, emerging pattern)
User wants telegram + terminal + socket to behave identically: "Please try each input channel equally", "the only difference maybe input format slightly different", "can we get message both on terminal and telegram", "each cron job send briefing".
- **Actionable:** Ensure the telegram integration uses the same `sendInput` codepath as terminal. Briefings from cron jobs should be routed to all active channels. Track in improvement-plan.md.

### Pattern 9: Workspace discipline — agents write ONLY in their own workspace (5+ occurrences)
User flagged: "some one generate /home/hao/may-agent/workspace and /home/hao/may-agent/knowledge, which is in wrong place", "agent should only generate content under their workspace/ folder". Coder also blind-overwrites files it didn't fully read.
- **Actionable:** Add a write-path guard: agents should only write to `agents/<name>/workspace/` and designated output dirs. The write tool should warn (not block) on writes outside workspace. Already partially addressed by read/write path resolution — verify it covers workspace boundaries.

### Pattern 10: Proactive autonomy — "don't wait to be told" (10+ occurrences)
User expects agents to be self-directing: "drain his backlog", "keep push it to the limit, fix as much as possible", "explore and try more jobs", "pick some top issue and keep working on it", "should have learned the todo convention". User wants heartbeat cron → check TODO → pick work → execute → report.
- **Actionable:** This is already item #1 in todo.md. Verify EVERY agent with a todo.md has a drain-todo cron job that actually fires. Audit: which agents lack this? 

### Unaddressed Ideas (mentioned but never implemented):
1. **Structured JSONL for human inputs** — mentioned 1x but aligns with OC pattern. Would enable automated trend analysis. (Already in todo as OC import item)
2. **Agent migration checklist** — user migrated 5 agents without a reusable template. Should be codified.
3. **Cron job briefing via telegram** — user asked if cron jobs can send briefings. Not yet implemented.


# Tracking (continued)

- [2026-03-05] ✅ Second human-inputs review completed. 1824 lines analyzed. 10 recurring patterns identified (3+ occurrences each). Top themes: verify-before-done, delegation discipline, cron management, efficiency/cost, turn budget, git hygiene, workspace boundaries, proactive autonomy.

---

## Human Input Pattern Review — 2026-03-06 (review #3, 1836 lines analyzed, +12 lines since last review)

**Delta since review #2:** 12 new human inputs (2026-03-05T14:52 → 2026-03-06T03:53). Combined with deeper analysis of the full 1836-line corpus, the following **new patterns** emerge (3+ occurrences threshold, not already captured in review #2):

### NEW Pattern 11: Briefings / observability — "tell me what happened" (8+ occurrences)
User repeatedly asks for summaries of system activity and wants proactive reporting:
- "I want to receive brief of the daily jobs" (03-06)
- "What about generate brief after each job and send to me?" (03-06)
- "I got no messages of the cron jobs, does it work?" (03-06)
- "how's the system running" (03-05)
- "can you run the cron job and report current states" (03-05)
- "show me all the living sessions" (03-04)
- "show me corn jobs" (03-05, 03-04 — multiple times)
- "please manually run the jobs for me, one by one until all done" (03-06)
- **Actionable:** Implement a post-job briefing system. After each cron job completes, write a short summary to a known location (e.g., `agents/may/workspace/briefings/`) and optionally push to telegram. User should NOT have to ask "what happened" — the system should tell them.
- **Owner:** May + Optimizer
- **Priority:** HIGH — this is the user's most recent frustration

### NEW Pattern 12: Cron reliability skepticism — "does it actually work?" (6+ occurrences)
User doesn't trust cron jobs are running correctly:
- "I got no messages of the cron jobs, does it work?" (03-06)
- "please trigger each cron job to make sure it works" (03-05, 03-04)
- "trigger the review-human-inputs job" (03-05)
- "investigate and fix it now" (03-05, after review-human-inputs failed)
- "not work" (03-05, after telegram setup)
- Overlaps with Pattern 3 (cron management) but this is a distinct trust/reliability issue — user can't tell if cron is silently failing.
- **Actionable:** Cron jobs should produce visible artifacts (log file, briefing, or telegram notification) on every execution. Silent success is indistinguishable from silent failure. Add a "last run" timestamp visible via cron.status().
- **Owner:** May (cron infrastructure)
- **Priority:** HIGH

### NEW Pattern 13: Env/config isolation — "don't break other instances" (4 occurrences)
User concerned about configuration leaking across instances:
- "We should not override the env, which would impact the instance spawn by it" (03-06)
- "We need something better, maybe an argument? Which is better than env" (03-06)
- "why not use only one .env?" (03-05)
- "we only want to enable cron for the main instance" (03-06)
- **Actionable:** Audit env var usage. Any env var that changes behavior (SCHEDULERS, model selection) should use CLI args or config files, not env vars that inherit to child processes. Document the isolation model.
- **Owner:** Optimizer
- **Priority:** MEDIUM

### NEW Pattern 14: Hot reload / zero-downtime expectations (3 occurrences)
User expects changes to take effect without restart:
- "Can you hot reload?" (03-06)
- "I would restart, then the cron job should be working" (03-05 — indicates restart was needed)
- "Let's just disable it for now" (03-06 — user gives up on fixing live)
- **Actionable:** Investigate which subsystems can be hot-reloaded (cron jobs? agent registrations? knowledge files?) vs which require restart. Document in usage.md. The `reloadAgents()` function exists but may not cover all cases.
- **Owner:** Optimizer
- **Priority:** LOW (nice-to-have)

### INTENSIFIED Pattern 3+: Cron as centralized management hub (now 110+ mentions across all inputs)
Since review #2, cron has evolved from "manage jobs" to "cron is the control plane for agent autonomy." User expects:
1. May manages ALL agents' cron jobs centrally
2. Each job produces a visible briefing
3. Jobs can be manually triggered for testing
4. Jobs use ephemeral sessions (not inject into main session)
- **Delta action:** The existing Pattern 3 actionable is insufficient. Need a cron management dashboard: list all jobs across all agents, show last-run time, show last-run result (pass/fail/skipped), and a trigger-now capability.

### INTENSIFIED Pattern 10+: Todo-driven autonomy is now the user's primary operating model
Since review #2, user explicitly asks agents to "drain backlog", "explore and try more jobs", "pick some top issue". The todo.md → drain-todo cron → work → report cycle is THE expected workflow.
- **Delta action:** Every agent with a workspace/todo.md MUST have a drain-todo cron job. Verify this is true for ALL agents (not just amy/scout/amy-kimi which were fixed in review #2).

### Unaddressed Ideas (new since review #2):
1. **Post-job briefing to telegram** — user asked 3x (03-06). Never implemented. HIGH priority.
2. **Cron job last-run metadata** — no timestamp tracking for when jobs actually executed. Needed for reliability trust.
3. **CLI arg for cron enable** — user explicitly said env vars are wrong approach (03-06). Not yet fixed.
4. **Context compacting for long-lived agents** — "Maybe coach agent need context compacting" (03-05). Not addressed.

### Reinforced Findings from Review #2 (still active):
- Pattern 1 (verify it works): Still the #1 preference. No new violations but user is now testing cron jobs specifically.
- Pattern 7 (git hygiene): "git checkout -- ." still appears in recent sessions from crashed optimizer runs.
- Pattern 9 (workspace discipline): Two new violations flagged (03-05: /workspace and /skills in wrong place).


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
