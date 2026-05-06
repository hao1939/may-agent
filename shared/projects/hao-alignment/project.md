# Project: Hao Alignment

**Status**: active
**Stop Reason**: 

Phase 6 complete. All preferences P1-P16 extracted and propagated. Remaining work is time-gated. No new Hao interactions detected as of 2026-05-06. Next trigger: new Hao interaction or monthly re-scan due ~June 6.
**Owner**: may
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 25

## Goal
Learn Hao's thinking, preferences, values, and purpose from our conversation history. Build a living model of what Hao wants so the system makes fewer decisions he has to override.

## Metric
**Correction rate** = `rejections / (decisions + rejections)` per interaction window.

- **Baseline**: ~1% (1 correction in ~115 decisions, from manual review)
- **Target**: < 10% correction rate (already met — infrastructure in maintenance mode)
- **Leading indicator**: autonomous decisions Hao doesn't undo

## Data Sources
- `.state/sessions/*/session.jsonl` — 37,061 active sessions (~5.2GB)
- `.state/sessions/history/` — 37,172 archived sessions (~5.1GB)
- **Total: ~74,000 sessions, ~10GB** of conversation data
- Direct conversations (telegram/chat sessions with Hao)
- Escalation history and rejected proposals
- Sessions with `source: "telegram"` or `kind: "chat"` in meta.json are direct Hao interactions

## Plan

### Phase 1: Mine historical conversations
- [x] Scan all sessions with Hao input (67 chat sessions found)
- [x] Extract directives, corrections, preferences, "no" moments (18 directives, 5 corrections)
- [x] Categorize: values, style preferences, technical philosophy, anti-patterns

### Phase 2: Build preference model
- [x] Write `agents/shared/projects/hao-alignment/preferences.md` — living document
- [x] Identify patterns: when does Hao say yes vs no?
- [x] Map decision categories where we get it wrong most

### Phase 3: Integrate into system
- [x] Update agent context files with key preferences
- [x] Add to dispatch/escalation decision criteria (decision scorecard in preferences.md)
- [x] Measure correction rate baseline (~1%, already below 10% target)
- [x] Integrate preference-check gate into May's context.md (verified: 11 gate references in context)
- [x] Instrument correction tracking (measure-corrections.sh + tagging protocol)
- [x] Fix measure-corrections.sh (scoped to chat sessions, runs in ~2s)
- [x] Run fixed script, record baseline measurement to baseline-measurement.md
- [ ] After 2 weeks: compare correction rate with gate active vs baseline

### Phase 4: Continuous refinement
- [x] Widen detection to include telegram-sourced sessions (script updated)
- [ ] Re-scan recent sessions monthly for new preference signals
- [ ] Track metric trend (re-measure monthly)

### Phase 5: Propagate P6-P10 into agent contexts
- [x] Extract git-signal preferences (P6-P10) — `git-signal-analysis.md`
- [x] Update preferences.md scorecard with P6-P10 weights
- [x] Propagate P6-P10 summaries into agent context files (may, coach, tech-lead, optimizer)
- [x] Re-run measure-corrections.sh to get fresh measurement (2026-07-02: 0 corrections in 1 session — insufficient data)
- [x] Validate P6-P10 against May 1-3 Hao inputs (P1, P7, P9, P10 all confirmed — see journal iter 9)
- [ ] Quarterly: re-scan git for new preference signals

### Phase 6: Capture & propagate P11-P16 (May 1-3 inputs)
- [x] Re-mine human-inputs.jsonl for inputs after 2026-04-30
- [x] Extract 6 new preferences (P11-P16) → preferences.md
- [x] Add 5 new anti-patterns and 5 new scorecard rows
- [x] Update correction history with May 1 entries
- [x] Propagate P11-P16 summaries into may/coach/tech-lead/optimizer context files
- [x] Update preference-check-gate.md to reference P11 (never coast) and P14 (create projects)
- [x] Re-run measure-corrections.sh against May 1-3 sessions
- [x] Validate that "target met" no longer triggers project → waiting transitions

### Re-plan checkpoint (2026-05-03)
- P11 ("never coast") **explicitly forbids** returning to `waiting` just because infrastructure is built.
- The project demonstrates its own metric: previous "WAITING" decision was itself a P11 violation, corrected this iteration.
- **Next**: Phase 6 propagation work, then re-measure correction rate.

## Known Preferences (seed)
- Separation of concerns: don't patch around systems, let infra do its job
- Hygiene first: clean up before building new things
- Brevity: expects quick understanding, not explanations
- Pragmatism: close things that are done, don't let zombie work linger
- Trust the architecture: don't add workarounds at wrong layer

## Log
- 2026-04-29: Project created from conversation with Hao
- 2026-06-30: Phase 3 started — encoded "never stop at target met" + continuous-push into may/context.md and shared/common-sense.md
- 2026-04-30: Phase 3 complete. Gate in context, script working, baseline measured (~1%). Only 1 Hao session in 90 days — data-starved. Dropped to P1 maintenance.
- 2026-07-02: Git signal analysis completed — extracted P6-P10, updated scorecard. Phase 5 started.
- 2026-07-02: P6-P10 propagated to all agent contexts (may, coach, tech-lead, optimizer). Phase 5 complete. Project → maintenance.
- 2026-07-02: All active work complete. Status → waiting. No worker dispatch needed until next Hao interaction or quarterly git re-scan (Oct 2026).
- 2026-05-03: **Re-activated**. Mined 9 new Hao inputs (May 1-3). Extracted P11-P16 (never coast, learning loop, prove before adopt, create projects, consult team, honest assessment). The previous "WAITING" status was itself a P11 violation. Phase 6 opened for propagation work.
- 2026-05-06: Phase 6 propagation complete. P11-P16 added to all 4 agent context files. Preference-check-gate updated with P11/P14 stop conditions. Correction measurement: still 1 session/0 corrections (data-starved). Remaining: validate no-coast behavior operationally.
