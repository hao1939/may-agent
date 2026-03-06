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
