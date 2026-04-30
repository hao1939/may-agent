# Project: Hao Alignment

**Status**: waiting
**Owner**: may
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 8

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

### Re-plan checkpoint
- Only 1 direct Hao interaction session exists in last 90 days — insufficient data for statistical measurement
- Infrastructure is complete: gate active, script working, preferences documented
- **Next value**: Extract preferences from indirect signals (Hao's commits, config changes, system design choices) rather than waiting for chat sessions
- Priority should drop to P1 — this is now maintenance/opportunistic

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
- 2026-07-01: All infrastructure complete. Status → waiting, Priority → P2. No active work needed until new Hao interactions provide fresh data.
