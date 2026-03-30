# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-30T16:10
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-30T16:10): 16 sessions in 2h since 14:10. Zero errors. Tech-lead 46ops (productive, test fixes, good eval). Scout 39ops (done). Coach 13+18ops (done). Amy-kimi 12+16ops (genuine LLM). Bob 3ops (done). QA 2ops (JS). May 1+1ops (JS). 24h: 191s, 2705 ops (14.2 avg), 18 errors (all tech-lead pre-fix jsonSchema). **Quality**: raw 72% good+acc (14 tech-lead crash evals in window), adjusted 98% good+acc (excl crash sessions). Tech-lead all good/acceptable since fix. System very healthy.
  Latest (2026-03-30T14:10): 43 sessions since 12:40 (1.5h). **TECH-LEAD JSONSCHEMA BUG FIXED** — after 13 consecutive errors (12:44-13:48), May investigated (164ops interrupted session), and tech-lead is now successfully running test-fix sessions (8 done, 3 running, 1-11ops each). Coach 36+41ops (2 heartbeats, both score 5). Bob 35ops(done). Optimizer 43ops(this session). Scout 3ops(error: JSON parse). QA 3ops. Amy 13ops. 24h: 186s, 2580 ops (13.9 avg). **Quality**: 92% good+acceptable (46/50), 86% good rate. Tech-lead now productive after 26h outage.
  Latest (2026-03-30T12:40): 11 sessions since 11:10 (1.5h). Coach 52ops(heartbeat,good eval), Bob 43ops(running), May 34ops, Optimizer 28ops, Amy 12ops(heartbeat), QA 3ops. 24h: 170s, 2245ops (13.2 avg), 20 errors (all tech-lead jsonSchema). **QUALITY RECOVERED**: 94% good+acceptable (47/50 last 50 non-skipped evals). 6h window: 70% good (33/47), 94% good+acceptable (44/47). Coach TASK_NONCOMPLETION from 09:00-10:00 now aging out. Amy-kimi: 4 sessions in 24h (9-17 ops, genuine LLM heartbeats) — new agent, healthy. Zero errors since 11:10.
  Latest (2026-03-30T07:10): 4 sessions since 06:10 (1h, ~4/hr — normal pace). Bob running (28ops last heartbeat), optimizer running, qa 1op (JS), may 1op (JS). 24h: 182s, 1946 ops (10.7 avg). Zero errors in 2h. **Quality RECOVERED**: 93% good rate (last 50 evals), 100% in last 6h windows. Quality drop from 69%→93% fully resolved (transient coach sprint burst + outage residuals).
  Latest (2026-03-30T06:10): 13 sessions/2h. optimizer 2(27ops), coach 2(27ops), bob 2(21ops), evaluator 1(14ops), scout 1(4ops), may 2(3ops), qa 2(2ops), tech-lead 1(0ops,error). 24h: 184s, 1981ops (10.8 avg). **QUALITY DROP**: Good eval rate 69% (was 84% yesterday). Root causes: coach sprint burst 09:00-09:30 (7 FM failures), connectivity outage residuals (5 sessions), tech-lead jsonSchema (5). Adjusted good rate ~78%. Finding at workspace/finding-quality-drop-0330.md.
  Latest (2026-03-30T05:10): 13 sessions/2h. By agent: qa 2(2ops), scout 2(17ops), optimizer 2(25ops), bob 2(27ops), may 2(3ops), coach 1(12ops), tech-lead 1(0ops,error), evaluator 1(14ops). 24h: 186 sessions, 2001 ops (10.8 avg). 5 errors (4 tech-lead jsonSchema recurring + 1 connectivity). System healthy.
  Latest (2026-03-30T04:10): 36 sessions in 6h, 370 ops (6/hr, 61.7 ops/hr). Zero interruptions. Only 1 error (tech-lead jsonSchema). Coach 116ops(8s), Bob 113ops(5s), Optimizer 107ops(5s). System healthy overnight. **Key finding**: Coach growth-cycle quality gap (23% good vs 85% heartbeat good). Finding at finding-coach-growth-cycle-quality-0330.md.
  Latest (2026-03-30T02:40): 9 sessions since 01:10 (1.5h). Coach 14ops, May 1op, QA 1op, Bob 27ops, Optimizer 28ops (all done), plus 4 running. Zero errors. 24h: 184s, 1909 ops, 1.3% waste (25 wasted ops). System very healthy. 3-day trend: waste improving (3.3%→1.3%), avg ops/session declining (12.8→10.4). Wrote efficiency-trend-report-0330.md.
  Latest (2026-03-30T00:40): 4 sessions since 23:10 (1.5h, ~2.7/hr — overnight lull). May 1op x2, Scout 2ops, QA 1op. Zero errors. System very quiet overnight. No issues.
  Latest (2026-03-29T23:10): 13 sessions since 21:40 (1.5h, ~8.7/hr — system picking up). 24h totals: 184 sessions, 1850 ops. Tech-lead jsonSchema error persists (22:39, 0 ops, known recurring bug). Bob running 27 ops (heartbeat). Coach 10+13 ops (normal). All healthy. No issues.
  _Older entries (Mar 26-29) pruned 2026-03-30T16:10. Key events: Bob 48h outage Mar 26-27 (model deprecation, fixed via socket reload Mar 27T14:03), connectivity outage Mar 29T13:06-13:21 (recovered). See finding files for details._

- [x] **Cost outlier scan** — Last done: 2026-03-30T16:10
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-30T16:10): 16 sessions in 2h. Max: tech-lead 46ops (test fixes, good eval — justified). Scout 39ops (done). Coach 18ops, Amy-kimi 16ops (normal). Zero cost outliers. 24h: 191s, 2705 ops (14.2 avg). System running lean.
  Latest (2026-03-30T14:10): 43 sessions since 12:40. **May 164ops INTERRUPTED** (investigating tech-lead 26h outage — justified high ops for infrastructure fix). Tech-lead 8 done sessions (1-11ops, test fixes — productive). Coach 36+41ops (heartbeats, both score 5 — normal). Bob 35ops (heartbeat, normal). Optimizer 43ops (this session). Zero cost outliers in normal operation. May's 164ops was exceptional/justified (fixed the tech-lead jsonSchema bug). 24h: 186s, 2580 ops (13.9 avg). System running lean.
  Latest (2026-03-30T12:40): 11 sessions since 11:10. Max: coach 52ops (heartbeat, good eval, justified). Bob 43ops (running). May 34ops (heartbeat). Optimizer 28ops (this session). Amy 12ops (heartbeat). Zero cost outliers. 24h: 170s, 2245 ops (13.2 avg). Tech-lead 5s/0ops (all jsonSchema errors, known recurring). System running lean. Coach TASK_NONCOMPLETION sessions from 09:00-10:00 no longer in active window.
  Latest (2026-03-30T07:10): 4 sessions since 06:10. Max: bob 28ops, optimizer 28ops (both normal heartbeats). QA 1op, May 1op (JS). Zero cost outliers. 24h: 182s, 1946 ops (10.7 avg). System very lean.
  Latest (2026-03-30T05:10): 13 sessions/2h. Max ops: bob 27, optimizer 25, scout 17, evaluator 14, coach 12. All normal. 24h: 186s, 2001 ops (10.8 avg). High ops (>30): coach 55(Mar29 09:12), optimizer 39(Mar29 09:06), bob 37/35/35. Zero cost outliers.
  Latest (2026-03-30T02:40): 9 sessions since 01:10 (1.5h). Max: optimizer 28 ops, bob 27 ops (normal heartbeats). Coach 14 ops (normal). Zero cost outliers. 24h: 184s, 1909 ops (10.4 avg). Waste: 1.3% (25 ops). No issues.
  Latest (2026-03-29T23:10): 13 sessions since 21:40 (1.5h). Max: bob 27 ops (normal heartbeat). Coach 13 ops (normal). Tech-lead 0 ops (error, jsonSchema bug). No cost outliers. 24h: 184 sessions, 1850 ops. System running lean.
  _Older entries (Mar 25-29) pruned 2026-03-30T16:10. Key events: Bob 48h error waste Mar 26-27 (~24 ops/day wasted), optimizer 35-op budget added Mar 26 (was 48% of system ops), maxTurns fix committed Mar 27, coach common-sense-verify timeout waste Mar 27. See finding files for details._

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-30T16:10
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-30T16:10): 16 sessions in 2h. QA 2ops (JS). May 1+1ops (JS). Evaluator 0ops (JS). Tech-lead 46ops (genuine LLM test fixes). Scout 39ops (genuine LLM). Coach 13+18ops (genuine LLM). Amy-kimi 12+16ops (genuine LLM). Bob 3ops (done). No new LLM-to-JS candidates.
  Latest (2026-03-30T14:10): 43 sessions since 12:40. QA 3ops (JS). May 1ops (JS). Evaluator 0ops (JS). Coach 36+41ops (genuine LLM heartbeats). Bob 35ops (genuine LLM). Amy 13ops (genuine LLM). Tech-lead: 8 done sessions fixing tests (genuine LLM — requires code understanding). Scout 3ops(error). No new LLM-to-JS candidates.
  Latest (2026-03-30T12:40): 11 sessions since 11:10. QA 2ops (JS), May 1op (JS). Amy 12ops (genuine LLM heartbeat). Coach 52ops (genuine LLM heartbeat). Bob 43ops (genuine LLM). No new LLM-to-JS candidates. Amy-kimi is a new agent doing genuine LLM heartbeats (9-17 ops) — not a JS candidate.
  Latest (2026-03-30T07:10): 4 sessions since 06:10. QA 1op (JS), May 1op (JS). Bob and optimizer running (genuine LLM heartbeats). No new LLM-to-JS candidates.
  Latest (2026-03-30T05:10): 13 sessions/2h. QA 1op (JS), May 1-2ops (JS), Scout 4-13ops (done). All high-op sessions doing genuine LLM work (heartbeats, evaluations). No new LLM-to-JS candidates.
  Latest (2026-03-30T02:40): 9 sessions since 01:10. QA 1 op (JS), May 1 op (JS). Coach 14 ops (common-sense-verify, genuine LLM). Bob 27 ops (heartbeat, genuine LLM). Optimizer 28 ops (heartbeat, genuine LLM). No new LLM-to-JS candidates.
  Latest (2026-03-29T23:10): 13 sessions since 21:40. QA 1 op (JS), Scout 2 ops (done), May 1 op (JS), Evaluator 0 ops (JS). Coach 10+13 ops (heartbeats, genuine LLM). Bob 27 ops (heartbeat, genuine LLM). Zero coder sessions post-restart. No new LLM-to-JS candidates.
  _Older entries (Mar 25-29) pruned 2026-03-30T16:10. Key actions: tool-quality-scan trend history implemented (Mar 26), circuit breaker candidate identified (Mar 27). All scans consistently show no new LLM-to-JS candidates — QA/May/Evaluator already JS-optimized._

- [x] **Handler health check** — Last done: 2026-03-30T16:10
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-30T16:10): 22 handlers (unchanged). Process 84e05c6 (PID 7/28) running since 10:49 (5.3h uptime). Zero errors in 2h window. Tech-lead all good/acceptable evals since jsonSchema fix. Tool quality baseline from 13:07 — waste 0.90% (all-time low, next baseline expected ~17:07). All systems nominal.
  Latest (2026-03-30T14:10): 22 handlers (unchanged). **TECH-LEAD JSONSCHEMA BUG FIXED at ~13:59**. After 13 consecutive errors (12:44-13:48, all `jsonSchema.properties` undefined), May investigated (164-op session) and tech-lead is now successfully completing sessions. Process 84e05c6 (PID 28) running since 10:42 (3.5h uptime). Tool quality baseline at 13:07 — waste rate **0.9%** (27/3001, ALL-TIME LOW, down from 2.36%). Scout had 1 JSON parse error (transient). System very healthy.
  Latest (2026-03-30T12:40): 22 handlers (unchanged). 11 sessions since 11:10. Zero errors since 11:10. Process 84e05c6 (PID 28) running since 10:36 (2h uptime). Tech-lead jsonSchema recurring (24h: 20 errors, all 0ops, dependency bug). Tool quality baseline at 09:07 (3.5h ago — expecting next baseline ~13:07). Coach 52ops session got good eval. All systems nominal.
  Latest (2026-03-30T07:10): 22 handlers (unchanged). 4 sessions since 06:10. Zero errors. Process running f83555f (HEAD) since Mar 29 15:07 (16.0h uptime). Tool quality baseline at 05:07 (2h ago). All systems nominal.
  Latest (2026-03-30T05:10): 22 handlers (unchanged). 13 sessions/2h. 1 error (tech-lead jsonSchema recurring). Process running f83555f (HEAD) since Mar 29 15:07 (14.0h uptime). All systems nominal.
  Latest (2026-03-30T02:40): 22 handlers (unchanged). 9 sessions since 01:10. Zero errors in window. Process running f83555f (HEAD) since 15:07 (11.5h uptime). Tool quality baseline at 01:07 (1.5h ago, fresh). Tech-lead jsonSchema bug recurring (~hourly, 0 ops, dependency issue). All systems nominal.
  Latest (2026-03-29T23:10): 22 handlers (unchanged). 13 sessions since 21:40. Tech-lead jsonSchema bug persists (22:39, 0 ops — recurring dependency issue). Process running f83555f (HEAD) since 15:07 (8h uptime). Tool quality baseline from 21:07 (2h ago, still fresh). All systems nominal.
  Latest (2026-03-29T21:10): 22 handlers (unchanged). Tool quality handler confirmed firing — latest baseline at 21:07 UTC, waste 2.67%. 11 sessions/3h, zero errors. Process running f83555f (HEAD) since 15:07. All systems nominal.
  Latest (2026-03-29T18:10): 22 handlers (unchanged). **Tool-quality handler NOW FIRING** — baseline.json and history.json updated at 17:07 UTC (first successful run on new binary f83555f!). Report.md still not generated (handler writes JSON, not MD — the trend.md generation may need separate code path). 5 sessions/1.5h, zero errors. System healthy. Process running f83555f (HEAD), restarted at 15:07.
  Latest (2026-03-29T16:40): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 83h+). 56 sessions/5.1h, 18 errors (15 connectivity outage 13:06-13:21, 3 tech-lead jsonSchema — recurring every hour, dependency bug). **Tech-lead jsonSchema bug persists**: 3 new instances (12:39, 13:39, 16:39) — `undefined is not an object (evaluating 'jsonSchema.properties')`. 4 running sessions (optimizer, bob, evaluator, coach). Process restarted at 15:07, binary at HEAD f83555f. System healthy post-outage recovery.
  Latest (2026-03-29T07:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 75h+). 17 sessions since 05:33 (2h), 193 ops, zero errors. All done. Distribution: bob 88 ops (3), optimizer 36 (3), coach 23 (2), tech-lead 23 (1), evaluator 12 (1), may 6 (3), qa 3 (3), scout 2 (1). System healthy and lean. Process restart remains #1 blocker.
  Latest (2026-03-29T01:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 69h+). ~9 sessions since 22:33 (3h), ~68 ops, zero errors. All done. System healthy and lean. Process restart remains #1 blocker.
  Latest (2026-03-28T22:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 66h+). 15 sessions since 20:33 (2h), 148 ops, zero errors. All done. Distribution: bob 57 (2), coach 47 (2, max 28 common-sense-verify), optimizer 19 (2), evaluator 9 (1), scout 10 (2), may 3 (3), qa 3 (3). System healthy and lean. Process restart remains #1 blocker.
  Latest (2026-03-28T20:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 64h+). 8 sessions since 17:33 (3h), 59 ops, zero errors. All done. Distribution: bob 30 (1), optimizer 12 (1), coach 11 (1), tech-lead 2 (1), may 2 (2), qa 2 (2). System healthy and lean. Process restart remains #1 blocker.
  Latest (2026-03-28T15:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 58h+). 14 sessions since 13:33 (2h), ~92 ops, zero errors. All done. Distribution: bob 35 ops (2), optimizer 26 (2), coach 10 (1), scout 6 (1), evaluator 5 (1), may 4 (4), qa 4 (3), tech-lead 2 (1). System healthy. Process restart remains #1 blocker.
  Latest (2026-03-28T13:33): 22 handlers (unchanged). Tool-quality-report.md still MISSING (blocked on restart, 56h+). 12 sessions since 11:33 (2h), 128 ops, zero errors. All done. Distribution: bob 61 ops (2), coach 38 (2), scout 12 (2), optimizer 10, qa 3, may 2, tech-lead 2. System healthy. Process restart remains #1 blocker.
  Latest (2026-03-29T23:10): 22 handlers. All healthy, no errors. Tool quality report normal. System stable post-restart.
  _Older entries (Mar 25-29) pruned 2026-03-30T16:10. Key events: maxTurns bug found+fixed (Mar 27), tool-quality-report.md MISSING degraded state (Mar 27, resolved by restart), 22 handlers consistently present. See finding files for details._

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-30T01:10
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: WEEKLY (or on-demand only).** With 54 skills and 5 consecutive saturation findings,
  discovery phases consistently find "no new skill needed." Coach evidence confirms: remaining failures
  need workflow enforcement (code-level), not teachable skills. Each lifecycle costs ~50 ops (workflow).
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-28T09:31): **4th consecutive saturation — NO NEW SKILL WARRANTED.** Full workflow run (wr_1774690451141_edsw). Phase 1 scanned recent sessions for patterns (Bob recovery, maxTurns enforcement, context learning A/B). All remaining failure patterns are code-level fixes, not teachable behavioral skills. 54 skills in library. Recommend marking skill lifecycle as COMPLETE/SATURATED and switching cooldown to weekly or on-demand only.
  Latest (2026-03-26T15:34): Early exit — no new pattern found. Scanned 10 recent sessions + 20+ findings. All remaining failure patterns are code-level fixes, not teachable skills. 54 skills, saturation confirmed for 3rd consecutive run. Discovery doc at `workspace/skill-discovery.md`. Saved ~90 ops via early-exit (no phases 2-4).
  Latest (2026-03-26T03:26): Full 4-phase lifecycle via workflow. Phase 1 discovered "guard-precision-refinement" (isToolError false-positive regex). Phase 2 correctly concluded it's a code fix, NOT a teachable skill — no SKILL.md created. Phase 3 documented TEST BLOCKED. Phase 4 verified existing build-activation-verification deployment. 54 skills now exist. Saturation signal confirmed — code fixes > prompt skills for remaining patterns. Next run: consider 12h cooldown or skip if no novel behavioral pattern observed.
  Latest (2026-03-25T18:11): Re-ran lifecycle — discovery found build-activation-verification pattern (same as 10:03 run). Phase 2 reused existing SKILL.md. Phase 3 re-tested: 2/3 gym pass, all behavioral checks 3/3. Phase 4 deployed to optimizer SOUL.md + sent requests for tech-lead/coder/bob SOUL.md updates.
  Latest (2026-03-25T10:03): build-activation-verification (18th skill) drafted, tested (2/3 gym pass, core assertions 3/3), deployed to optimizer + tech-lead SOUL.md. Pattern: agents build binaries and claim "deployed" but don't verify the running process switched. 206 lines.
  Latest (2026-03-25T03:03): prerequisite-gap-protocol drafted and tested — 0/3 gym pass (agents claim success even with missing prerequisites). NOT deployed. Skill identifies real pattern but needs prompt injection to change behavior.
  Latest (2026-03-24T21:03): No new skill needed — discovery found deliverable-integrity pattern already deployed. 17 skills achieving good coverage.
  Latest (2026-03-24T14:03): deliverable-integrity (17th skill) deployed to agents. Full lifecycle. 3/3 gym pass.
  Latest (2026-03-24T06:06): progressive-work-persistence (16th skill) deployed to 6 agents. Full lifecycle.
  Latest (2026-03-23T21:36): verification-consistency (15th skill) deployed to 6 agents. Full lifecycle.
  _13 earlier skill deployments documented in finding files. See `workspace/finding-pattern-scan-*.md`._

- [x] **Tool quality review** — Last done: 2026-03-30T16:10
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-30T16:10): Waste rate **0.90%** (27/3001) — ALL-TIME LOW (holding from 13:07 baseline, 3h old). Trend: 2.69%→2.67%→2.65%→2.80%→2.36%→0.90% — dramatic sustained improvement. Coach sole remaining waste source (7 bash:other, 2 read:nonexistent-path, 1 read:empty-args, 1 bash:timeout-killed). Next baseline expected ~17:07. No regression. Binary 84e05c6 running since 10:49.
  Latest (2026-03-30T14:10): Waste rate **0.90%** (27/3001) — ALL-TIME LOW. Down from 2.36% at 09:07. Trend: 2.69%→2.67%→2.65%→2.80%→2.36%→0.90% — dramatic improvement. Only 27 wasted calls in 24h window (was 63). Top: bash:other=7(coach), read:nonexistent-path=2(coach), read:empty-args=1(coach), bash:timeout-killed=1(coach). Coach is sole source of remaining waste. No regression. Binary 84e05c6 running since 10:42.
  Latest (2026-03-30T12:40): Waste rate **2.36%** (63/2667) — baseline from 09:07 (3.5h old, next expected ~13:07). Top: bash:other=30 (48%), bash:nonexistent-path=8, bash:cmd-not-found=6, edit:edit-match-fail=4. Trend: 2.69%→2.67%→2.65%→2.36% — steady improvement, at all-time low. Binary changed to 84e05c6 at 10:36 — first baseline on new binary expected at ~13:07. No regression.
  Latest (2026-03-30T07:10): Waste stable ~2.65% (from 05:07 baseline). No sessions with tool errors since 06:10. System very clean. No regression.
  Latest (2026-03-30T04:10): Waste stable ~2.65%. No coder sessions recently so no new waste sources. 36 sessions/6h, zero tool errors flagged (except 1 tech-lead crash). No regression.
  Latest (2026-03-30T02:40): Waste rate **2.65%** (70/2646, from 01:07 baseline). Trend stable for 5 readings: 1.3% → 2.76% → 2.69% → 2.67% → 2.65%. Top: bash:other=36 (51%), bash:nonexistent-path=12, bash:cmd-not-found=8. Coder #1 offender but zero coder sessions recently. No regression.
  Latest (2026-03-29T21:10): Waste rate **2.67%** (70/2624). Trend: 1.3% → 2.8% → 2.7% → 2.67% (stable, 3 readings near 2.7%). Top: bash:other=36 (51%), bash:nonexistent-path=12, bash:cmd-not-found=8, edit:edit-match-fail=4, read:nonexistent-path=4, bash:empty-args=4, write:empty-args=2. Coder worst offender across 4 categories. No regression.
  Latest (2026-03-29T18:10): **Handler now generating JSON data!** Baseline at 17:07: waste rate **2.69%** (70/2605). Trend: 1.3% → 2.76% → 2.69% (stable). Top wasters: bash:other=36 (qa, coach, coder), bash:nonexistent-path=12 (coder, coach), bash:cmd-not-found=8 (coder, qa), edit:edit-match-fail=4 (coder), read:nonexistent-path=4 (coach), bash:empty-args=4 (coach, coder), write:empty-args=2 (coder). bash:other still #1 at 51% of waste. Coder is worst offender across multiple categories. No regression from previous 2.8%.
  Latest (2026-03-29T16:40): Report still MISSING (blocked on restart, 83h+). Last known: 2.8% waste at 05:07 Mar 27. Process restarted at 15:07 with HEAD binary f83555f — tool quality handler should now be active. Next report expected at next 4h cron cycle. No manual assessment possible without the report.
  Latest (2026-03-29T01:33): Report still MISSING (blocked on restart, 69h+). Last known: 2.8% waste at 05:07 Mar 27. ~9 sessions since 22:33, zero errors. No manual assessment possible without the report. Status unchanged — all blocked on restart.
  Latest (2026-03-28T20:33): Report still MISSING (blocked on restart, 64h+). Last known: 2.8% waste at 05:07 Mar 27. 8 sessions since 17:33, zero errors. No manual assessment possible without the report. Status unchanged — all blocked on restart.
  Latest (2026-03-28T15:33): Report still MISSING (blocked on restart, 58h+). Last known: 2.8% waste at 05:07 Mar 27. 14 sessions since 13:33, zero errors. No manual assessment possible without the report. Status unchanged — all blocked on restart.
  Latest (2026-03-28T13:33): Report still MISSING (blocked on restart, 56h+). Last known: 2.8% waste at 05:07 Mar 27. 12 sessions since 11:33, zero errors. No manual assessment possible without the report. Status unchanged — all blocked on restart.
  Latest (2026-03-27T20:33): Report still MISSING — handler not generating output. Blocked on process restart (PID 52, binary from Mar 24). Last known: 2.8% waste at 05:07. No manual assessment possible without report. Status unchanged from 17:34.
  Latest (2026-03-27T17:34): Report still MISSING — handler not generating output (6+ hours since last check). Cannot assess tool quality. Last known: 2.8% waste at 05:07. Manual scan found coach bash anti-patterns (12 cat/head calls in one session). Blocked on process restart.
  Latest (2026-03-27T12:03): Report still MISSING — handler not generating output (same since 07:33). Cannot assess tool quality. Last known: 2.8% waste at 05:07. Blocked on process restart. No change.
  Latest (2026-03-27T10:33): Still missing — handler not generating output (same as 07:33). Cannot assess tool quality. Last known data was 2.8% waste at 05:07. Infrastructure monitoring gap persists — blocked on process restart.
  Latest (2026-03-27T07:33): **REPORT MISSING** — tool-quality-report.md does not exist. Handler not generating output (see handler health check). Cannot assess tool quality trends. Last known data was 2.8% waste at 05:07 (before state reset). System functioning but no tool quality instrumentation active. Requests.db also 0 bytes. Infrastructure monitoring gap.
  Latest (2026-03-27T05:33): Report from 05:07. **Waste rate 2.8%** — major improvement from 4.3% at 01:07 (down 35%)! Total waste 61 calls (was 109). bash:other=33 (qa=12, coder=11, coach=5, optimizer=5), bash:nonexistent-path=17 (coder=16, all /home/user), edit:empty-args=5, read:empty-args=3, read:nonexistent-path=3 (coach). Optimizer waste down significantly (6 vs 33 previously). Trend: 4.7%→4.3%→2.8% — steadily improving. No new regressions.
  Latest (2026-03-26T22:33): Report from 21:07. Waste rate 4.1% (115/2823) — down from 4.7% earlier today. Top: bash:other=71 (optimizer 33, qa 16, coder 13), bash:nonexistent-path=17 (coder 16 — all `/home/user`), empty-args=15 (read:9 + bash:6). **ACTION**: Sent patch to May (req:e228ee50) to add `/app` working directory lesson to coder LESSONS.md — should eliminate 16 wasted calls/day. Trend: improving (4.7%→4.1%).
  Latest (2026-03-26T06:33): Waste rate 4.7% (trending up: 4.1→4.4→4.7). Regressions: bash:empty-args +75% (14, was 8), read:empty-args +600% (7, was 1). Optimizer worst offender (12/21 empty-args). Coach developing new failure modes: finish:empty-args(2), finish:schema-violation(2), bash:convention-block(2). All fixes blocked on process restart. No new interventions possible. Finding at `workspace/finding-tool-quality-0326-0633.md`.
  Latest (2026-03-26T02:40): **BUG FIX**: Found and fixed false positive in `isToolError()` (manager-utils.ts). Old regex `/exit\s*(code\s*)?\d*[1-9]\d*/i` matched "exit code 1" anywhere in output — false-triggers when grep/read output contains exit code mentions in content (e.g., grepping error logs). Fixed to anchor to bash.ts format: `/Command exited with code \d*[1-9]\d*/`. Coder ERROR_LOG showed FM-1.2 PIVOT_SIGNAL_IGNORED caused by this. Updated test/tool-pivot.test.ts with false-positive test cases. All 87 related tests pass.
  Latest (2026-03-25T22:34): Report from 21:07 UTC. Waste rate 4.4% (slightly up from 3.8%). bash:other=162 (85.7% of waste), optimizer=78 wasted calls (worst offender, 49% of all waste). bash:empty-args=11 (optimizer=7, coach=4). read:nonexistent-path=8 (skill-discovery.md pattern). bash:nonexistent-path=3 (all /home/user errors). All interventions already in binary f10cfde — blocked on restart. No new interventions needed.
  Latest (2026-03-25T18:33): Report from 17:07 UTC. Waste rate 3.8% (stable). bash:other=136 (83% of waste), optimizer=60 wasted calls (worst offender). bash:empty-args regressed: 12 (was 8, +50%). QA npx fix deployed but blocked on restart. Sub-classifier deployed but blocked on restart. All improvements blocked on PID restart (req:e535d4d8). No new interventions needed — existing fixes just need activation.
  Latest (2026-03-25T12:43): Deep-dived bash:other (148 calls, 69% of waste). Sub-classified: CMD_NOT_FOUND=56% (npx/bun/sqlite3), FILE_NOT_FOUND=26%, CD_BAD_PATH=19%. **ROOT CAUSE FOUND**: QA SOUL.md instructs `npx tsc`/`npx vitest` but npx isn't in PATH — causes ~70/148 waste calls alone (47%). Sent P0 fix to tech-lead: replace with `./node_modules/.bin/tsc`/`./node_modules/.bin/vitest`. Also sent P1 patch to improve classifyFailure() with 3 new sub-categories. Findings at `workspace/finding-qa-npx-not-available-0325-1243.md` and `workspace/finding-bash-other-subclassify-0325-1240.md`.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-29T23:10
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-30T16:10): Binary 84e05c6 running since 10:49 (5.3h). No gym runs on 84e05c6 yet (latest gym data on 31895e7). Previous successful baseline: 11/13 pass (85%) on 37b8fbb. Gym baseline STILL NEEDED on 84e05c6. Tech-lead actively fixing tests — may want to wait for next binary before investing in baseline. No regression data available.
  Latest (2026-03-30T10:40): **NEW BINARY 84e05c6** deployed at 10:30 (process restart). Commit: "remove: opBudget enforcement — always unlimited". Gym run ACTIVE (coder oneshot spotted in ps). Previous baseline: f83555f never completed (background run timed out). Last successful: 11/13 pass (85%) on 37b8fbb. Baseline needed on 84e05c6 — but gym run may already be in progress from coach growth-cycle.
  Latest (2026-03-29T23:10): No change. Gym baseline on f83555f still needed. Binary unchanged. Latest data: Mar 29 02:56 sweep on 31895e7 (old binary). Last successful optimizer-run baseline: 11/13 pass (85%) on 37b8fbb. Needs dedicated cron:optimize session.
  Latest (2026-03-29T18:10): **Gym baseline STARTED** in background on binary f83555f (batch 1774807991_bca04137). 17 smoke scenarios running. Binary may-agent-f83555f (built Mar 29 15:02, running process). Symlink updated: may-agent-latest → may-agent-f83555f. Results pending — check next heartbeat. Previous baseline: 11/13 pass (85%) on 37b8fbb.
  Latest (2026-03-25T07:27): Full smoke baseline on binary 37b8fbb. 11/13 pass (85%) — same as previous baseline (335546d). Zero regressions. 2 red: behavior-escalation-stubborn (0/4, needs escalation skill), conflicting-evidence (0/4, correct diagnosis but wrong fix). 1 yellow: optimize-deploy-config (67%, flaky). Batch: 1774422494_11c91301. Results in may.db + gym-trend-tracker.md updated.
  **NOTE**: New binary f10cfde built (2026-03-25T22:10) — includes LESSONS.md loading restore, agent archetype inheritance, DOMAIN.md restore, verification gym scenarios, 30 test fixes, all bbbe4fe features. Gym baseline needed after process restart activates it.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-30T09:10
  Latest (2026-03-30T09:10): Cycle 19. 3 meaningful commits since Cycle 18 (opBudget removed, ENV_FACTS injection, vitest fix). Tool waste at all-time low 2.36%. Quality 97.4% good+acceptable. Process restart wall CLEARED. No new interventions needed. 4 coder sessions spawned (coach→coder pipeline working). Still open: ANTHROPIC_API_KEY, meta.json cost tracking, coder tool waste. Full review at `workspace/improvement-proposals-review-0330.md`.
  Latest (2026-03-28T09:06): Cycle 17. 26 new commits since Cycle 16. Major: context learning full pipeline (8 commits), guard revert per Hao directive, skills loading P0 fix, maxTurns enforcement (my finding), circuit breaker gap fix (my code). PID 52 now 64 commits behind HEAD (was 37 at Cycle 16). 51 skill files (down from 54 — guard revert). 22 handlers. 47 cron entries. Guards officially deprioritized. Context learning deployed to 6 agents (A/B showed no measurable improvement but infra deployed). Restart wall still #1 bottleneck — 10+ blocked items. Tool waste improving: 2.8% (last known). Full review at `workspace/improvement-proposals-review-0328.md`.
  Latest (2026-03-27T03:03): Cycle 16. 5 new commits since Cycle 15 (guard arch batch 2, prompt simplification, LESSONS.md revert, skill scanner P78, read safety guards). PID 52 now 37 commits behind HEAD (was 26 at Cycle 15). 54 SKILL.md files (+14), 18 deployed (unchanged). 22 handlers (unchanged). 5 guard files in HEAD, 0 active in running PID. Bob down 10+ hours (gemini-3-pro-preview deprecated). Restart wall is #1 bottleneck — 11+ blocked files. Tool waste improving: 4.7%→4.1%. Full review at `workspace/improvement-proposals-review-0327.md`.
  Latest (2026-03-26T04:38): Cycle 15. 8 guards (991 lines, only 4 active in running binary). 40 SKILL.md files (+2), 18 deployed (+1). 22 handlers. PID 52 now 32 commits behind HEAD (was 10 at Cycle 14). 12 improvements blocked on restart (LESSONS.md/DOMAIN.md restore, 4 guards, isToolError fix, archetype inheritance, zombie cleanup, request limits, web UI, gym DB). 22 real test failures. Guards > Skills > Prompts hierarchy confirmed by auto-evolve results. Skill lifecycle | 2026-03-28 09:34 | ~12h | 4x saturation (no-new-skill)
  Latest (2026-03-24T16:03): Cycle 14. 23 code improvements (+5), 17 skills deployed (+6), 38 SKILL.md files, 7 guards (804 lines). Binary rebuilt (b9ef77e) but 10 commits behind. Prompt simplification landed (SOUL.md+common-sense.md only). Top priorities: binary rebuild (again), ANTHROPIC_API_KEY, FM-2.2 structural fix, measure prompt size savings. Full review at `workspace/improvement-proposals-review-0324.md`.

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-17
  Latest (2026-03-17): Graduated error-log-scanner.ts to cron.json. 2 orphaned handlers remain. Full log at `workspace/graduation-log.md`.
  Review all agents' heartbeat.md files. For each step, ask:
  1. Has this step been running for 1+ weeks?
  2. Is the pattern stable (same structure, same inputs/outputs)?
  3. Could it be expressed as a focused cron message?
  If yes to all three → propose a cron entry to May. The heartbeat step
  gets replaced with creative/directional work. Track graduated steps in
  workspace/graduation-log.md. See `agents/shared/tasks/work-maturity-ladder.md`.

---

- [x] **LESSONS.md graduation audit** — Last done: 2026-03-17
  Scan all agents' LESSONS.md files. For each entry, check:
  1. Is it a duplicate of a shared convention? → Remove (should be in shared/LESSONS.md)
  2. Has it been active for 2+ weeks? → Graduate to structural home or delete
  3. Is the agent-specific example still needed? → Keep if yes, trim if bloated
  Target: each agent's LESSONS.md under 2,000 bytes.
  Latest (2026-03-17): Automated via `agents/may/handlers/lessons-graduation.ts` (daily cron). All agents under 2K. **This task is now automated.**

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
