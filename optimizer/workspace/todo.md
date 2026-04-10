# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- **Post-restart baseline (2026-04-10)** — System restarted after 16-day gap. First 6h snapshot: 27 sessions, 282 ops, $12 total cost ($48/day rate). **12h update**: 45 sessions, 729 ops, ~$35 total ($78/day projected). Cost drivers: scout $7.14 (2 expensive heartbeats reading papers, 900K-1.15M tokens each), bob $11.09 (99-op deliver-or-report P1). Waste rate near 0% across all agents. Cost increase from $48→$78/day is legitimate work activity, not waste.
- **Bob heartbeat dispatch consistency** — First post-restart HB: 63 ops inline (bad). Second: dispatched via `deliver-or-report` workflow (good). **24h update (Apr 10 08:53)**: 6/47 HBs (13%) still inline-heavy (62-123 ops, zero forks). These 6 account for ~409 excess ops (16.6% of bob's total). But 87% of HBs are properly dispatched (median ~12 ops). Text rules already in heartbeat.md. Per KE-002, additional text won't fix the remaining 13%. Would need structural fix (heartbeat maxTurns cap) or accept as residual.
- ~~**⚠️ may.db sessions/evaluations tables STALE**~~ — **RESOLVED** (verified 2026-04-10 11:23). DB is now live — 18 sessions in last hour, latest entry matches current time. Tech-lead or system fix restored DB sync. `sessions` and `evaluations` tables both current.
- ~~**QA finish_partial scoring anomaly**~~ — **FIX DEPLOYED** (commit 474b5145, 2026-04-10). Root cause identified: QA was self-imposing mandatory tsc/vitest runs from SOUL.md during heartbeats, failing (tools don't exist in env), and finishing as `blocked`/`partial` → Q:2-3 instead of Q:4-5. In last 48h: 3 finish_blocked + 3 finish_partial out of 34 QA evals (18% penalized). Fix: updated QA context.md to explicitly state tsc/vitest unavailable, directing QA to use static analysis and not report blocked for known env constraints.
- ~~**EXP-031: On-Demand Workflow Discovery**~~ — DONE. KE-026 already synthesizes all findings (0/30 discovery across 3 resource types). No separate KE entry needed.
- **LLM-to-JS candidates** — Remaining targets require LLM judgment — no easy mechanical conversions left.

### Stale / resolved after restart
- ~~Cost/cache analysis~~ — Finding file archived (2026-03). Will re-measure when we have 48h of post-restart data.
- ~~Coach model misconfiguration~~ — Finding file archived (2026-03). Need to verify with current coach sessions.
- **LLM evaluations** — VERIFIED STILL RELEVANT. All evals are heuristic-only or JS-evaluated (skippedByJs). No LLM evaluator sessions running. This is by design if JS evaluator is sufficient, but limits evaluation depth.
- **Session digest quality** — Cannot verify (digest column removed from sessions table). May need alternate approach.

## ⚠️ SENT/ESCALATED (awaiting others)

- **Amy-kimi API billing** — 5 consecutive 429 errors (insufficient balance / token quota). Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao review)

- **Memory Redesign Brief** — At `workspace/brief-memory-redesign.md`. Needs Hao decisions. 2026-03-17.

## ✅ DONE (archived 2026-04-08)

**48 items completed Mar 17 – Apr 8.** Key deployments:
- Dispatcher mode for all 5 agents (optimizer/bob/coach/tech-lead/scout) — 81-94% HB ops reduction
- Skill pruning: 23 files removed from coach & evaluator (90KB overhead eliminated)
- Workflow audit: 9/11 shared workflows NEVER USED, 9 dead workflows archived, REGISTRY corrected
- LLM-to-JS: analyze-failures converted (78 ops/wk saved)
- Evaluator heuristic fix (45.5%→74.5% good rate)
- Coach training-sprint reliability (run-workflow handler, $2-5/day saved)
- Turn budget guidance, maxTurns guardrail, zombie cleanup, tool quality regressions (×5)
- Various findings: system waste (13% true waste), fix-without-verification, workflow collapse root cause

Detailed findings in `workspace/finding-*.md` and `workspace/brief-*.md`.
Tool quality regressions [1-5] all resolved — waste rate 0.07-2.4%, not actionable.
Tool quality regression #6 (bash errors ×4 categories) — investigated 2026-04-09. 42/59 bash:other = classifier gap (gym ✓/✗ format). Rest = natural variance from 2 bob sessions. **FIX DEPLOYED** (commit 79141deb, 2026-04-10): Added ✗ regex, `TESTS FAILED`, `N failed out of N tests` to test-failure classifier. Also expanded git-error and exit-code-nonzero coverage.
Tool quality regression #7 (2026-04-09 03:23) — bash:other 28 (+180%), edit:other 2 (+100%), bash:exit-code-nonzero 11 (+267%). Root cause: bob gym scenario dev (27/28 bash:other from bob), tech-lead exploratory greps. Waste rate 2.2% — elevated but not actionable. Same classifier-gap pattern as #6.
Tool quality regression #8 (2026-04-09 07:23) — bash:exit-code-nonzero 21 (+91%), read:nonexistent-path 8 (+167%), bash:nonexistent-path 8 (+300%), edit:other 5 (+150%). Root cause: bob 104-op gym remediation session + coach wave-2 validation/few-shot deployment. Same development-activity pattern as #6/#7. Not actionable.
Tool quality regression #9 (2026-04-09 11:23) — bash:exit-code-nonzero 52 (+148%), bash:other 49 (+81%), plus bash:nonexistent-path, edit:other. Root cause: bob heavy research sessions (79-op HB, multiple 40-70 op research/integration sessions), coach multi-session harness phases 1-3, tech-lead manager.ts bug fixes. Same development-activity pattern as #6/#7/#8. Not actionable.
Tool quality regression #10 (2026-04-09 13:32) — 6 regressed categories. Waste rate 5.2% (was 4.1%). bash:exit-code-nonzero 111 (+127%), edit:edit-match-fail 18 (+200%), bash:git-error 28 (+27%), read:nonexistent-path 47 (+27%), read:other 8 (+33%), bash:nonexistent-path 17 (+31%). Root cause: bob dominates all 6 categories (205/229 regressed errors = 89%) — heavy EXP-087/EXP-089 experiment research (grepping knowledge base, reading nonexistent hypothesis files, edit mismatches). Bob had 169 evals in 24h with clusters at Apr 8 20:49-23:22 (67 sessions) and Apr 9 10:22-10:30 (4 high-waste sessions). Coder contributed 12 read:nonexistent-path and 42 bash:other but at only 0.5% waste rate. Tech-lead had 1 high-waste session (5 wasted from 140 ops). Overall waste rate crossed 5% threshold for first time but is driven entirely by bob's high-volume research activity, not systematic misuse. Same development-activity pattern as #6-#9. Not actionable.
Tool quality regression #11 (2026-04-09 15:23) — 8 regressed categories. bash:exit-code-nonzero 75 (+44%), bash:other 63 (+29%), bash:nonexistent-path 33 (+65%), read:nonexistent-path 9 (+29%), bash:timeout-killed 6 (+100%), bash:git-error 6 (+100%), edit:edit-match-fail 5 (+100%), read:other 5 (+67%). Verified: actual waste rates 0-1.1% across all agents (bob 0.3%, coach 0.3%, qa 1.1%). Elevated absolute counts driven by bob (23 sessions) and coach (13 sessions) heavy development. Same development-activity pattern as #6-#10. Not actionable.
Tool quality regression #12 (2026-04-09 22:29) — 1 regressed category. bash:nonexistent-path 21 (was 17, +24%). Waste rate 5.9% (was 5.2%). bob dominates (19/21 = 90%), tech-lead 2. Only 1 category regressed vs 6-8 in prior scans — activity is winding down. Examples: bob referencing nonexistent knowledge base files (PRIORITY-TRACKER.md, deep-dives, hypotheses). Same development-activity pattern as #6-#11. Not actionable.
Classifier gap fix deployed (2026-04-09 23:27) — Improved `classifyFailure()` in tool-quality-scan.ts: (1) git-error now catches gitignore blocks, review gate blocks, push rejections, nothing-to-commit (+47 chains); (2) edit-match-fail now catches "Found N occurrences" ambiguous matches (+5 chains); (3) exit-code-nonzero now catches all non-zero codes, not just 1-2 (+5 chains for code 127). Total: 50 chains moved from `other` to proper categories (67% reduction in unclassified bucket). 23 tests pass.
Tool quality regression #13 (2026-04-09 23:23) — 1 regressed category. read:nonexistent-path: 10 (was 8, +25%). Tiny absolute increase (+2). System waste rates near 0% across all agents in last 6h. Same development-activity pattern as #6-#12. Not actionable.
Tool quality regression #14 (2026-04-10 03:24) — 4 regressed categories. Waste rate 4.7% (was 5.3%) — actually improved. bash:git-error 50 (was 6, +733%), edit:edit-match-fail 9 (was 5, +80%), bash:timeout-killed 10 (was 6, +67%), read:other 7 (was 5, +40%). Root cause: **classifier fix artifact, not real regression**. The classifier gap fix deployed at 23:27 reclassified chains from `other` to proper categories: bash:other dropped 65→8 (-57 chains) while bash:git-error rose 6→50 (+44) and edit:edit-match-fail rose 5→9 (+4). The +733% git-error spike exactly matches the ~47 chains the fix was expected to reclassify (gitignore blocks, review gate blocks, push rejections). bash:timeout-killed (+4) = bob's `git push k3s main` timing out at 120s — remote push issue, not tool misuse. read:other (+2) = noise. All errors from bob only. Not actionable — this is the classifier working correctly.
Tool quality regression #15 (2026-04-10 07:24) — 1 regressed category. bash:other: 10 (was 8, +25%). All from bob research sessions. Root cause: truncated command output where "Command exited with code N" was cut off — classifier couldn't detect exit-code-nonzero. **FIX DEPLOYED** (commits 0c2ab70 + 48e73ff7, 2026-04-10): Added fallback for `isError:true` + `^exec failed:` rootCause → exit-code-nonzero. 25 tests pass. Expected to move all 10 chains from bash:other to exit-code-nonzero in next scan.

### Deliver-or-Report Phase Boundary Waste (2026-04-10 09:53)
**Mode C exploration** — Skill & Technique Scouting, found structural workflow issue:
- Bob's deliver-or-report workflow splits into Phase 1 (analyze) + Phase 2 (write)
- Phase 1 says "DO NOT WRITE DELIVERABLES YET" — **text rule, fails 23% of the time** per KE-002
- When Bob writes in Phase 1, Phase 2 becomes redundant (finds work already done, finishes ~5-12 ops of nothing)
- **48h data**: 25 Phase 1 sessions, 24 Phase 2 sessions. 50% of Phase 2 sessions are ≤12 ops (redundant)
- **109 ops wasted** on redundant Phase 2 sessions + 49/215 evals (23%) penalized for phase-boundary violations
- **FIX DEPLOYED** (commit 5df41205, 2026-04-10 10:01): Early exit check between Phase 1 and Phase 2 — uses `existsSync` to detect if planned files already exist. Three paths: (a) all exist → skip Phase 2 entirely, (b) some exist → narrow Phase 2 to missing files only, (c) none exist → full Phase 2. Also added `extractFilePaths()` helper and Phase 2b retry for missing deliverables.
- **Pre-fix baseline (24h)**: 20 Phase 2 sessions. 12/20 (60%) were redundant (≤15 ops), consuming 121 ops. 8/20 were productive (169 ops). **Expected savings: ~121 ops/day (42% of Phase 2 ops).**
- **Measurement**: Next heartbeat cycle should show skipped Phase 2 sessions in bob's workflow runs. Look for `phase2-skipped-early-delivery` step events or significantly fewer Phase 2 sessions.
- **BUG FOUND (2026-04-10 10:53)**: Early exit was NEVER triggering. Root cause: `lastAssistantText` is the finish() summary (no file paths), not the plan message. `extractFilePaths()` always returned `[]`, so `plannedFiles.length > 0` was always false. **All 10 post-fix Phase 2 sessions ran full normal path.** FIX: commit fbff24ba — now scans ALL assistant messages via `phase1.messages` array for file path extraction. Also caps planText at 4000 chars for prompt injection. Added observability logging.

### QA Journal Token Waste (2026-04-10 09:23)
**Mode B exploration** — Tool Gap Analysis, found major token waste:
- QA heartbeat instructs `read("workspace/journal.md")` every heartbeat — journal is 270KB / 4,682 lines
- QA runs ~47 sessions/day, each reading the full journal = **3.18M tokens/day wasted** (~$9.50/day)
- QA's tokens/op (36,710) is 10x higher than optimizer (3,392) — journal read is the driver
- QA outcomes never reference old journal entries — only current findings
- **Sent to tech-lead** — both requests (req:e3a52c95, req:77a2b7b5) marked COMPLETED. QA heartbeat.md now uses `tail -5` for journal reads instead of full read. QA recent ops: 4-11 (down from previous levels).
- Expected savings: ~3M tokens/day after fix

### Workflow Health Check (2026-04-10 08:23)
**Mode D exploration** — Post-restart workflow audit (48h window):
- **implement-and-review**: Heavy use by bob (60 Phase 1+2 sessions), **100% success rate**. Verdict parsing fix validated. Phase 1 avg 31 ops, Phase 2 avg 20 ops.
- **auto-loop**: 7 runs (new), all successful.
- **fewshot-inject**: 2 runs (new), both successful.
- **implement-and-adversarial-review**: 2 runs, 100% success.
- **Dead workflow candidates**: may/design-then-build (0 runs ever), may/research-pipeline (0 runs ever), may/project-monitor (1 run ever, disabled), coach/convention-review (0 ever), coach/verify-setup (0 ever). Total: 367 lines dead code.
- **Dormant optimizer workflows**: design-review, enhance-cron, safe-edit — 0 runs in 14d (761 lines). Historical usage exists but dormant.
- **No action needed now** — next cleanup round can archive may+coach dead workflows.

### Bob Quality Score Artifact (2026-04-10 11:23)
**Mode A exploration** — Session Archaeology, found evaluator scoring artifact:
- Bob's quality avg is 2.47 — dramatically below all other agents (next lowest: QA 3.15, others 3.91+)
- **Root cause**: 44/97 evaluations (45%) have sub-1.0 quality scores (0.25-0.90). All are LLM-evaluated (not heuristic).
- 39/44 sub-1.0 scores (89%) come from deliver-or-report Phase 1/Phase 2 sessions
- The LLM evaluator penalizes Phase 1 for writing files ("Phase 1 constraint violated") AND penalizes Phase 2 for Phase 1's behavior (task prompt contains Phase 1 output with violation evidence)
- **Double-counting**: Same phase-boundary violation penalizes 2 sessions. If bob writes in Phase 1, both Phase 1 AND Phase 2 get sub-1.0 quality.
- Without these 44 artifacts: bob's remaining 53 sessions avg Q:3.87 (in line with other agents)
- **Impact**: Low priority. Only 2 `needs_improvement` verdicts → 3 coach sessions (111 ops). Quality metrics misleading but not causing expensive cascades.
- **Possible fixes**: (a) Evaluator: recognize Phase 1/2 as workflow sub-sessions and evaluate workflow-level, (b) exclude phase-boundary evaluations from agent-level aggregation, (c) early exit fix (deployed) should reduce Phase 2 redundancy.
- **Status**: Recorded. Not actionable enough to fix now — early exit fix is the primary intervention.
