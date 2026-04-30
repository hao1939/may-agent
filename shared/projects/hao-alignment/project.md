# Project: Hao Alignment

**Status**: active
**Owner**: may
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 3

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
- [ ] Propagate P6-P10 summaries into agent context files (may, coach, tech-lead, optimizer)
- [ ] Re-run measure-corrections.sh to get fresh measurement

### Re-plan checkpoint
- Git signal analysis was viable — extracted 5 new preferences (P6-P10)
- Scorecard updated, but agent contexts only minimally reference new preferences
- **Next**: Propagate into agent contexts, then return to maintenance/monitoring mode

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
