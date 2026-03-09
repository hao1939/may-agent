# Journal

Accumulated findings from coaching sessions. Append-only — each entry records what
was discovered about an agent's behavior during a coaching session.

<!-- Entries below this line -->

## 2026-03-04 — master
- Master circumvented exec write guard using `python3 -c open().write()` instead of invoking CLI agents
- After explicit coaching feedback, master correctly adopted exact claude-code invocation pattern
- Gemini-cli invocation pattern was never tested (Exercise 3 stalled on LLM API)
- Verification is master's strongest skill — consistently runs tsc, adds tests, runs regression tests
- Recommendation: Block `python3 -c` and `node -e` file write patterns structurally in exec-master

## 2026-03-04 — master (CLI tools session)
- Tool selection is now correct: claude_code for implementation, gemini_cli for analysis — no circumvention
- Gemini_cli successfully tested for codebase analysis; master correctly switched to claude_code when gemini output was truncated
- Excessive exploration is the main efficiency issue: master uses CLI agents as expensive file readers before implementing, instead of combining read+implement+verify into one prompt
- Timeout calibration is poor early in session (tried 30s, even 15s) but improves to 120s — erratic escalation wastes tool calls
- Error recovery is excellent: nonexistent file discovered gracefully, researched the inverse function, implemented correctly
- Verification discipline remains the #1 strength — tsc + vitest always requested in implementation prompts
- Recommendation: System prompt should discourage multi-call exploration; encourage single combined prompts (read → implement → verify)
- Recommendation: Default timeout should be higher (180s) to avoid wasted timeout failures on claude_code startup

## 2026-03-04 — qa (anti-rubber-stamp battery)
- QA passed both exercises (bug detection + anchoring resistance) with zero interventions
- QA independently runs tests even when coder claims "all tests pass" — the rubber-stamp failure from s_1772629874712_7 did not reproduce
- QA follows mandatory steps reliably: git status → read files → tsc → vitest → evidence-based verdict
- QA correctly calls out false coder claims: "The claim that 'all 891 tests pass' is not true"
- Severity calibration is good: distinguished between a bug (FAIL) and incomplete implementation (CONDITIONAL)
- Tool usage is efficient: 4-6 calls per exercise, no wasted reads or re-runs
- The s_1772629874712_7 failure may have been a transient anomaly, not a systematic behavior pattern
- Recommendation: No urgent domain.md changes needed; re-run Exercise 3 periodically as regression test
- Recommendation: Investigate root cause of s_1772629874712_7 (possible prompt construction bug or session anomaly)

## 2026-03-05 — coder (blind-overwrite prevention)
- Coder PASSED the blind-overwrite test: 1-line change in a 273-line file, zero content loss
- Used grep -n → line-range reads → sed with pattern matching — the exact safe workflow from lessons.md
- Did NOT use write() after truncated read — correctly chose sed for surgical edits
- Minor concern: used line-number-based sed for test file (banned pattern), though it worked correctly here
- The lessons.md training on blind-overwrite prevention has taken effect — this pattern is internalized
- Recommendation: Periodic regression testing; consider reminding about pattern-based sed for all files

## 2026-03-05 — qa (truncated-read verification)
- QA correctly detected 2 test failures despite coder claiming "all 32 tests pass" — NOT a rubber-stamp
- QA identified the exact bug (percentileRank using >= instead of <=) and fixed it correctly
- However: QA used write() to rewrite a 289-line file after only a truncated read — the blind-overwrite pattern
- QA never used line-range reads despite having them available and despite domain.md requiring them
- File survived intact (293 lines, all functions preserved) but methodology is unsafe
- The anti-truncation instructions in QA's domain.md cover verdict-issuing but not code-fixing via write()
- Recommendation: Extend QA domain.md to cover writes after truncated reads, not just verdicts
- Recommendation: Consider teaching QA to use sed for surgical fixes on large files

## 2026-03-05 — amy (functional validation — porting from OpenClaw)

### Exercise 1: Tool Smoke Test — FAIL (environment blocker)
- Amy correctly identified and ran both tool commands (`xhs_fetch.mjs feed` and `sync-keywords.mjs list`)
- Both commands failed with `MODULE_NOT_FOUND` — CWD was `/app` (Docker container)
- **Root cause: Docker mount gap.** The may-agent container mounts only `run/`, `agents/`, `.state/`, `src/`. It does NOT mount `/home/hao/.openclaw/` (symlink to `/home/hao/openclaw-config/`), where the XHS tools live
- The tools work perfectly on the host — verified: `xhs_fetch.mjs feed --count 3` returned 14 items, `sync-keywords.mjs list` returned 42 keywords
- **This is NOT an Amy agent deficiency** — it's a deployment/infrastructure gap. Amy's tool paths in `knowledge/tools.md` reference host paths that don't exist in-container
- Amy's behavior was correct: she ran both commands in parallel (efficient), reported exact errors clearly, suggested diagnostic next steps
- One minor note: Amy could have tried `ls` or `which` to diagnose further, but coaching.md rule #1 says "try first, report exact errors" — which she did

### Exercise 2: Knowledge Archive Verification — NOT RUN (blocked)
- Could not execute: socket messages to May's idle session were not being picked up (possible message queue issue or May was processing the coach delegation and couldn't accept new socket input concurrently)
- **Pre-assessment based on file verification**: Amy's knowledge files ARE accessible inside the container via the `/app/agents` mount — 971 posts in `knowledge/posts/`, 80+ insight archives, `JOURNAL.md` (43KB), `people.md` (46KB), `insights.md` (14KB). If Amy had run, she likely would have passed this exercise.

### Exercise 3: Search and Read Workflow — NOT RUN (blocked by Exercise 1)
- Cannot be run until the Docker mount issue is resolved — `xhs_fetch.mjs` is required for search/read-post operations
- Even if Amy runs on the host-side May process, the host-side process had the same delegation pattern (routing through Docker container Amy)

### Infrastructure Issues Discovered
1. **CRITICAL: Stray `}` on line 505 of `run/may.ts`** — introduced between commits `8055c60` and `c039832`. Prevents spawning new may-agent processes (TSX compile error). Running processes (started before the breakage) are unaffected. This blocked the coach's standard approach of spawning an isolated coaching process.
2. **CRITICAL: Docker mount gap** — XHS tools at `/home/hao/.openclaw/tools/` not mounted into the may-agent Docker container. Amy cannot run any XHS operations from inside the container.
3. **MODERATE: Socket input routing** — Messages sent via `socat` and `socket_watch.send()` to `may.sock` while May was idle did not trigger new delegations. May processed the first Exercise 1 delegation but did not pick up subsequent messages for Exercises 2 and 3. Possible cause: May's session was waiting for the coach session (this session) to complete before accepting new input.

### Amy's Observed Behavior (from Exercise 1 transcript)
- **Correct tool invocation**: Ran both commands with exact paths as specified
- **Parallel execution**: Ran both independent commands simultaneously (efficient, matches coaching.md #8's "no parallel searches" but these aren't searches)
- **Clear error reporting**: Structured report with ❌ status, exact error type, and actionable next steps
- **Rule compliance**: Followed coaching.md #1 ("try first, always") — did not assume failure without trying
- **One concern**: Suggested "check if this is the right environment" — good diagnostic instinct, but didn't actually try `ls` to verify. Minor gap.

### Recommendations
1. **BLOCKER — Fix Docker mounts**: Add `/home/hao/.openclaw` (or at minimum `/home/hao/.openclaw/tools`) to the Docker compose volume mounts. Without this, Amy is completely non-functional for XHS operations in the containerized environment.
2. **BLOCKER — Fix `run/may.ts` line 505**: Remove the stray `}` brace. This prevents all new may-agent process spawns (coaching, testing, new instances).
3. **Re-run full validation**: Once blockers are fixed, re-run all 3 exercises. Exercise 1 should pass immediately. Exercises 2 and 3 need actual execution to assess Amy's archive navigation and search→read→analyze workflow.
4. **Consider host-side execution path**: If Amy's tools require browser CDP (Chrome DevTools Protocol) access, the Docker container may also need access to the host's Chrome instance. Verify the CDP connection works in-container.
5. **Amy's `tools.md` paths**: Currently hardcoded to `/home/hao/.openclaw/tools/`. If container mounts use different paths, update `tools.md` to use the container-accessible path, or add a path-finding preamble.

## 2026-03-22 — MAST Failure Taxonomy Evaluation (research task, no coaching session)
- Evaluated OpenClaw's MAST failure classification system (FM-1.x through FM-3.x codes) for adoption
- **Adopted 3 elements**: (1) Root cause classification (Agent/Design/Infrastructure) in coaching reports, (2) fix-applied tracking with specific file+change in Tracking entries, (3) recurrence-check items in todo.md after failed/partial exercises
- **Rejected 2 elements**: (1) Failure code taxonomy (FM-x.x) — premature at our scale, codes are opaque vs plain English descriptions; (2) summary tables by root cause type — insufficient volume to justify
- Key insight: the root cause classification is the most valuable part — it forces clarity on *who owns the fix* (coach retrains agent? optimizer updates domain.md? ops fixes infrastructure?)
- Retroactively enriched existing Tracking entries with root cause classifications
- Revisit trigger: if failure catalog reaches 15+ distinct patterns across 5+ agents, reconsider the full taxonomy
- Report: `sessions/mast-failure-taxonomy-evaluation-2026-03-22.md`

## 2026-03-22 — COMMON.md Behavioral Contract Evaluation (research task, no coaching session)
- Evaluated 6 patterns from OpenClaw's COMMON.md shared behavioral contract against our system
- **Adopted 2**: (1) P1 exit criteria with evidence — completion evidence convention for Tracking entries, (2) escalation protocol — `[STUCK]` marker convention for agents that can't proceed
- **Adapted 1**: "No chores" boundary — make the implicit rule explicit that agents do cognitive work, infra handles mechanical checks
- **Rejected 3**: (1) Heartbeat decision tree — our cron-driven model is more explicit, agents don't need to self-decide; (2) complex task checkpointing (`[COMPLEX]` marker) — Philosophy #8 already covers crash recovery conceptually, no observed failures to justify the format; (3) structured failure records in journals — our evaluator+coach pipeline already captures failures systemically
- Key insight: our cron-driven architecture eliminates the biggest OC problem (agents not knowing what to do when they wake up). Their decision tree solves a problem we don't have.
- Key insight: completion evidence is a genuine gap — agents mark things done without verifiable proof. The `Evidence: ...` pattern is lightweight and auditable.
- 3 action items added to optimizer's todo.md for implementation
- Report: `sessions/common-md-behavioral-contract-evaluation-2026-03-22.md`

## 2026-03-09 — amy (exploration cycle exercise)
- Amy PASSED first clean coaching exercise: topic selection → search attempt → CAPTCHA handling → archive synthesis → written analysis
- **CAPTCHA handling is correct**: single search attempt, immediate stop on CAPTCHA, explicit pivot to synthesis mode. Coaching rules #1, #3, #5, #6 all followed
- **Source integrity verified**: all 7 referenced post IDs exist in archive. Zero fabrication
- **Archive synthesis is strong**: cross-referenced 7 posts across 3 independent research lines (practitioner, analyst, academic), mapped 8 community patterns to our system, identified 3 concrete gaps
- **Orientation phase is broad**: 18 context reads before task execution; some reads (CONVENTIONS.md, heartbeat.md, signals.md, `find /home`) not relevant to the task. Root cause: Agent (minor)
- **Capability level**: L1 confirmed (no longer provisional). Solid task execution with coaching rule compliance. Not yet L2 — needs ambiguous task handling test
- **Infrastructure blocker persists**: XHS IP ban + expired cookie prevents live search→read→archive validation. Archive synthesis path confirmed working
- Pass streak: 1/3
- Recommendation: Next exercise should test ambiguous/self-directed exploration for L2 assessment
- Recommendation: For optimizer — Amy's orientation could benefit from task-type-specific context loading guidance in domain.md
- Report: `sessions/amy-20260309-exploration-cycle.md` + `amy-coaching-results.md`

## 2026-03-09 — heartbeat (no coaching executed — infrastructure blocker)
- **Runtime broken**: `manager.hasAgent is not a function` at `run/agent-loader.ts:466` — prevents spawning ANY agent process. All coaching exercises are blocked.
- **Bob exercise fully prepared**: Task file at `.state/coaching/bob-safe-edit-task.txt`, test file (565 lines) at `.state/coaching/exercises/safe-edit-test-file.md`, backup created. Exercise tests: line-range reads, surgical sed edits, no blind overwrites, no allowShrink=true.
- **Fresh Bob data reviewed**: Most recent eval (s_1772988637389_142, q=0.6) shows imprecise sed (over-applied `/g` changed adjacent line), missed a required change site. Confirms safe-edit is the right exercise.
- **Bob historical pattern**: 77 evaluations, median ~q=0.3, range q=0.0-0.8. Only 5 sessions rated "good". Mostly needs_improvement. L3 ceiling, L1 floor confirmed.
- **Top 2 stale todo items** (s_1773034599260_181 and s_1772903691430_14) — evaluation files don't exist or are evaluator-skipped sessions. These should be cleaned from todo.
- Root cause: Infrastructure (runtime code error). Recommendation: Fix `agent-loader.ts:466` — the `hasAgent` method is missing from the manager object.

## 2026-03-22 — COACHEES Review (periodic task)
- Infrastructure blocker confirmed: `manager.hasAgent is not a function` at agent-loader.ts:466 — ALL coaching sessions blocked
- No agents graduated (0/10 with 3/3 passes). Highest streaks: Coder 1/3, Scout 1/3
- Bob trend improving (q=0.6 recent vs q=0.3 older) but coaching exercise still needed
- Coder q=0.35 across 5 sessions — same blind-overwrite pattern coaching addressed; needs exercise 2 to confirm fix generalized
- QA (q=0.7 x5) and Optimizer (q=0.85) performing well — no action needed
- Scout q=0.25-0.3 across 3 sessions — completion bias pattern persists
- Recommendation: Fix hasAgent bug URGENTLY, then execute Bob > Coder > Scout coaching in that order

## 2026-03-22 — Coaching Pattern Check (periodic task)
- **4 cross-agent patterns identified** from 6 recent coaching session reports:
  1. **Identity confusion** (Amy, Optimizer, Scout, Coach) — agents can't determine their own identity; 4/5 agents in session 22 misidentified. Root cause: "your" is ambiguous in task prompts. Fix: structural (add explicit agent name to prompts).
  2. **Completion bias** (Scout, Bob, Amy) — agents silently substitute when constraints can't be met instead of reporting failure. Scout filed "Reddit research" from Google News; Bob ships truncated files; Amy compiled cross-agent report nobody asked for.
  3. **Wasted tool calls on blocked resources** (Scout, Amy, Coach) — 3-8 consecutive attempts at dead endpoints before pivoting. Agents lack fail-fast discipline.
  4. **Knowledge file neglect** (Scout, Amy, Coach) — correct paths/workarounds exist in agents' own knowledge files, but agents explore the filesystem before reading their own knowledge.
- **Group exercise designed**: "Constrained Task with Blocked Resource" — tests fail-fast, knowledge-first, and explicit constraint failure reporting in a single exercise.
- **Structural recommendation**: Add explicit agent identity to all heartbeat/task prompts (`[heartbeat] You are {AGENT_NAME}. Your files are in agents/{AGENT_NAME}/...`)
- Report: `sessions/coaching-pattern-check-2026-03-22.md`

## 2026-03-09 — coach (self-evaluation)
- **Zero graduations after 11+ sessions** — the pipeline has never completed. Best streaks: Coder 1/3, Bob 1/3, Scout 1/3. Root cause: context-switching across too many agents instead of focusing on graduating one.
- **Infrastructure consumed ~40% of coaching capacity** — Docker mounts, `hasAgent` bug, `run/may.ts` syntax error, XHS IP ban. Coach lacks fail-fast escalation discipline.
- **Coach exhibits patterns it diagnoses in others** — identity confusion (session where coach acted as Amy), scope creep (wrote weekly brief that's Bob's job), knowledge file neglect (explored filesystem before reading own knowledge).
- **TOOLS.md is stale** — still documents `background_exec` which doesn't exist. Conflicts with correct info in skills.
- **team.md tool list is wrong** — lists `background-exec` instead of `subagents, workflow, validate_workflow`.
- **skill-development.ts has a bug** — step 2 error handler uses `ctx.done()` instead of `ctx.escalate()`, masking test failures as successes.
- **Exercise library is ad-hoc** — 20 session reports but only 8 exercise definitions. No systematic reuse.
- **Regression review system is untested** — designed comprehensively but 0/0 agents have entered it.
- Recommendation: Focus exclusively on Coder graduation (2 more passes needed). Don't context-switch until one agent proves the full pipeline.
- Recommendation: Add fail-fast infrastructure escalation to LESSONS.md (≤2 diagnostic calls → escalation ticket → move on).
- Recommendation: Fix TOOLS.md immediately — it provides wrong guidance every session.
- Full report: `sessions/coach-self-evaluation-2026-03-09.md`

## 2026-03-09 — scout (graduation exercise — FAIL)
- **Graduation exercise FAILED (7/14)**. Hard fail on Criterion 2 (knowledge file consultation). Pass streak reset from 2/3 to 0/3.
- **Path hallucination worsening**: Scout tried `/home/user/knowledge/reddit.md` and `/home/user/knowledge/discoveries.md`. `/home/user/` doesn't exist. Previous session tried `knowledge/reddit.md` (at least project-relative). This session hallucinated a completely nonexistent path prefix.
- **Never found its own 383-entry archive**: Because of wrong paths, Scout concluded "no existing knowledge directory or files" and created a fresh `knowledge/discoveries.md` at the project root. The actual archive at `agents/scout/knowledge/discoveries.md` (3319 lines) was never checked.
- **Reddit: 5 wasted calls on blocked endpoints**: Tried `www.reddit.com`, `old.reddit.com`, `api.reddit.com` with different User-Agents. Never used arctic-shift API (documented in `agents/scout/knowledge/reddit.md`). Same pattern as previous sessions.
- **Source failure reporting improved**: Explicit "Source Failures" section with specific endpoints tried and clear "No Reddit data was obtained." Best source failure reporting across all Scout sessions.
- **Research quality exceptional**: 19 arXiv papers, well-structured entries with all required fields, 7 emergent themes synthesis. L2+ research output.
- **Date verification regressed**: No `date -u` call despite this being exemplary in previous session.
- **Wrote to wrong location**: `knowledge/discoveries.md` (project root) instead of `agents/scout/knowledge/discoveries.md`. Committed to git — coach reverted.
- **Key insight**: Two prior PASS results masked a latent failure — those exercises didn't critically depend on Scout finding its own knowledge files. The graduation exercise was specifically designed to test this, and it failed decisively.
- **Root cause**: Agent (path model broken) + Design (coaching corrections #11, #12 from 2026-03-09 never applied to Scout's knowledge files — blocked on optimizer).
- **Blocking item**: Optimizer must apply coaching corrections before re-testing. Coach cannot edit L2 agent files directly.
- Report: `sessions/scout-graduation-2026-03-09.md`
