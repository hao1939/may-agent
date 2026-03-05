# TODO
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
