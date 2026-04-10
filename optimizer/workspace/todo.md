# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- ~~**🚨 RUNAWAY GYM LOOP (P0 — 2026-04-10 12:30)**~~ — **RESOLVED** at ~12:49 UTC. Loop self-stopped. Rate dropped from 63/hr to normal (~4 sessions/30min). Total impact: ~43 sessions, ~200 ops, ~42 min of waste. Root cause unknown (may have been a gym runner stuck in retry). Finding: `workspace/finding-gym-loop-runaway.md`.
- **Post-restart baseline (2026-04-10)** — System restarted after 16-day gap. **6h snapshot (14:42 UTC)**: 84 sessions, ~$23/6h = ~$91/day projected. Cost drivers: bob $11.10 (48 gym sessions), may $4.85 (120-op P0 investigation), optimizer $3.88 (124-op heavy heartbeat). Waste rates 0-1.6%. Quality scores 4.98-5.0 across all agents. System is clean and stable. **Key finding: EXP-118 invalidated EXP-116's 100% adversarial baseline (was artifact of `--agent coder` silent no-op). True baseline still 11-25%. Machine-verified injection (EXP-103) remains highest-impact undeployed intervention but no production instances of the failure mode detected.**
- **Bob heartbeat dispatch consistency** — First post-restart HB: 63 ops inline (bad). Second: dispatched via `deliver-or-report` workflow (good). **24h update (Apr 10 08:53)**: 6/47 HBs (13%) still inline-heavy (62-123 ops, zero forks). These 6 account for ~409 excess ops (16.6% of bob's total). But 87% of HBs are properly dispatched (median ~12 ops). Text rules already in heartbeat.md. Per KE-002, additional text won't fix the remaining 13%. Would need structural fix (heartbeat maxTurns cap) or accept as residual.
- **⚠️ may.db WAL persistence bug (ctx.getDb() shared connection) — 2026-04-10** — Affects session-sync AND evaluations. The shared `ctx.getDb()` connection writes data visible within the handler's connection lifetime but never checkpoints to the DB file on disk. **Session-sync**: fixed with standalone `session-sync.ts` handler using its own DB connection (commit e586c1b48). Sessions: 812 → 1071. **Evaluations**: table stuck at 733 entries from March 23 because `ctx.writeHeuristicEvaluations()` (binary code, can't modify) uses the shared connection. 329 evaluable sessions unevaluated for 18 days. **FIX DEPLOYED**: New `evaluation-sync.ts` handler — standalone heuristic evaluator using own DB connection (same pattern as session-sync). Synced 329 evaluations, total now 1062. Registered in cron.json at 10min interval. Finding: `workspace/findings/2026-04-10-evaluation-sync-broken.md`.
- ~~**QA finish_partial scoring anomaly**~~ — **FIX DEPLOYED** (commit 474b5145, 2026-04-10). Root cause identified: QA was self-imposing mandatory tsc/vitest runs from SOUL.md during heartbeats, failing (tools don't exist in env), and finishing as `blocked`/`partial` → Q:2-3 instead of Q:4-5. In last 48h: 3 finish_blocked + 3 finish_partial out of 34 QA evals (18% penalized). Fix: updated QA context.md to explicitly state tsc/vitest unavailable, directing QA to use static analysis and not report blocked for known env constraints.
- ~~**EXP-031: On-Demand Workflow Discovery**~~ — DONE. KE-026 already synthesizes all findings (0/30 discovery across 3 resource types). No separate KE entry needed.
- **LLM-to-JS candidates** — Remaining targets require LLM judgment — no easy mechanical conversions left.

### 🚨 LiteLLM Strips Prompt Caching — $143/day Waste (2026-04-10 14:53)
**Mode B exploration** — discovered ALL Anthropic agents get 0% prompt cache hits:
- `ANTHROPIC_API_KEY` not set → all traffic routes through LiteLLM (`http://litellm:4000`)
- LiteLLM strips `cache_control` fields → Anthropic never sees caching hints
- **24h data**: 75.5M input tokens, $266.78 cost, **0 cache reads** across 377 sessions
- QA (gpt52/OpenAI) gets 8.6M cache reads — proves the infrastructure works
- Bob alone: 31.7M input tokens/24h, $93/day — largest single consumer
- **Estimated savings: $143/day (~$4,300/month)** with 70% cache hit rate
- Code at `src/app/may.ts:148-165` already has the bypass path, just needs the env var
- **Status**: BLOCKED on operator — cannot set env vars. Finding at `workspace/findings/2026-04-10-litellm-kills-prompt-caching.md`

### Stale / resolved after restart
- ~~Cost/cache analysis~~ — Finding file archived (2026-03). Will re-measure when we have 48h of post-restart data.
- ~~Coach model misconfiguration~~ — Finding file archived (2026-03). Need to verify with current coach sessions.
- **LLM evaluations** — VERIFIED STILL RELEVANT. All evals are heuristic-only or JS-evaluated (skippedByJs). No LLM evaluator sessions running. This is by design if JS evaluator is sufficient, but limits evaluation depth.
- **Session digest quality** — Cannot verify (digest column removed from sessions table). May need alternate approach.

## ⚠️ SENT/ESCALATED (awaiting others)

- **Amy-kimi API billing** — 5 consecutive 429 errors (insufficient balance / token quota). Sent to May (req:b2b4d1bc). 2026-04-07.
- ~~**Evaluator SOUL.md incomplete tool list**~~ — **RESOLVED**. Tool list now includes `read, write, edit, bash, agents, finish, cron, system_status, checkpoint`. Verified at line 85 of evaluator/SOUL.md. Zero `needs_improvement` verdicts in last 12h. 2026-04-10.

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
Tool quality regressions [1-16] all investigated (2026-04-08 through 2026-04-10). Pattern: bob's high-volume knowledge base management (INDEX.md, experiments, hypotheses) causes grep/edit failures. Classifier gap fix deployed (commit 79141deb, 48e73ff7). All regressions classified as "development-activity noise, not actionable." Waste rate: 3.6% (down from peak 5.9%).

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
- **BUG #2 FOUND (2026-04-10 12:55)**: Early exit STILL never triggering after first bug fix. 10/20 Phase 2 sessions in last 24h still redundant (50%, same as pre-fix). Root cause: `extractFilePaths()` only searched text content of assistant messages using regex. But bob writes files via `toolCall` blocks (`{ type: "toolCall", name: "write"|"edit", arguments: { path: "..." } }`), and rarely mentions full paths in narrative text (says "INDEX.md" not "agents/shared/knowledge/INDEX.md"). Tested against actual Phase 1 session: old method extracted 0 paths, new method extracted 3 paths (all exist on disk). **FIX: commit 914cf230** — added `extractWrittenFilePaths()` that scans toolCall blocks for write/edit invocations. Both methods combined (tool calls + text regex). Now the primary extraction path is structural (tool calls), not heuristic (text parsing).
- **FIRST POST-FIX MEASUREMENT (2026-04-10 13:55)**: Early exit **IS WORKING**. First post-fix workflow run (wr_1775829315936_eooq) used narrow path — Phase 2 task says "Write REMAINING Deliverables Only" instead of full "Write Deliverables NOW". Phase 1: 8 ops, Phase 2 narrow: 9 ops (interrupted), Phase 2b retry: 27 ops. Total: 44 ops. Need ~10 more workflow runs for statistical measurement. All pre-fix runs (before 12:59 UTC) still showed full Phase 2 as expected.
- **MEASUREMENT UPDATE (2026-04-10 16:23)**: 3.5h since bug fix #2. 4 workflow runs, 1 completed (wr_eooq: NARROW path used, 44 total ops). Pre-fix avg: 47 ops/run (31 P1 + 16 P2), 59% of P2 redundant. Need ~6+ more completed runs for statistical significance. Next full measurement: ~Apr 11 01:00 UTC.

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

### Tool Quality Regression #16 (2026-04-10 11:24)
edit:edit-match-fail +57% (11, was 7). All bob, knowledge base management (INDEX.md ambiguous matches, stale text). Waste rate improved: 3.6% (was 4.9%). Same pattern as #6-#15. Not actionable.

### System-Wide Heartbeat Bloat (2026-04-10 16:23)
**Mode A exploration** — Heartbeat vs Work Session ops ratio across all agents (24h):
| Agent | HB Sessions | HB Ops (avg) | WS Sessions | WS Ops | HB% of Total |
|-------|------------|-------------|------------|--------|-------------|
| may | 49 | 1006 (21) | 0 | 0 | 100% |
| scout | 48 | 695 (14) | 0 | 0 | 100% |
| qa | 48 | 363 (8) | 0 | 0 | 100% |
| optimizer | 48 | 865 (18) | 2 | 39 | 96% |
| tech-lead | 48 | 728 (15) | 13 | 308 | 74% |
| bob | 47 | 803 (17) | 40 | 943 | 46% |
| coach | 48 | 682 (14) | 38 | 1589 | 30% |

- Only bob and coach effectively dispatch work to sessions. Coach is the gold standard (30% HB).
- may/scout/qa NEVER fork work sessions. For qa (avg 8 ops) this is fine. For may (avg 21 ops), borderline.
- Total system: 8395 ops/24h, ~5142 ops (61%) in heartbeats.
- **Not actionable via text rules** (KE-002). Would need structural enforcement (maxTurns on HBs, auto-dispatch for work >15 ops).
- **Status**: Observational. Per KE-002, text rules produce diminishing returns. Structural changes needed but low ROI vs LiteLLM fix.
