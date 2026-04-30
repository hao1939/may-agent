# Project: Hao Alignment

**Status**: active
**Owner**: may
**Priority**: P0
**Workflow**: master-worker
**Iteration**: 6

## Goal
Learn Hao's thinking, preferences, values, and purpose from our conversation history. Build a living model of what Hao wants so the system makes fewer decisions he has to override.

## Metric
**Correction rate** = `rejections / (decisions + rejections)` per interaction window.

- **Baseline**: TBD (measure from historical sessions)
- **Target**: < 10% correction rate
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
- [ ] Measure correction rate over time
- [ ] Add preference-check gate to May's dispatch logic

### Phase 4: Continuous refinement
- [ ] Each Hao interaction → extract new signals
- [ ] Update preference model
- [ ] Track metric trend

## Known Preferences (seed)
- Separation of concerns: don't patch around systems, let infra do its job
- Hygiene first: clean up before building new things
- Brevity: expects quick understanding, not explanations
- Pragmatism: close things that are done, don't let zombie work linger
- Trust the architecture: don't add workarounds at wrong layer

## Log
- 2026-04-29: Project created from conversation with Hao
- 2026-06-30: Phase 3 started — encoded "never stop at target met" + continuous-push into may/context.md and shared/common-sense.md
