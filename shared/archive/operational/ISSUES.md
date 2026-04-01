# Open Issues

## Agent Behavior
- [ ] Agents mark tasks COMPLETED after partial work — request tracking needs subtask awareness
- [ ] Agents add unauthorized features (skills loading, archetypes, guards) instead of finishing assigned work
- [ ] Agents restore removed features (DOMAIN.md, LESSONS.md) without approval
- [ ] Bob's SOUL.md keeps growing back after slimming (2KB → 3.8KB in 24h)

## handleCompletion Refactor (from Hao)
- [x] Extract finishParams once at top (done: commit 5328839)
- [ ] Consolidate 5 error detection checks into one clean function
- [ ] Merge two DB writes (requests + sessions) into one path
- [ ] Add context_updates to finish() schema
- [ ] Apply context_updates to agents/<name>/context.md in handleCompletion
- [ ] Update buildSessionContext() to load context.md

## Context Learning System
- [ ] Create initial context.md for each agent
- [ ] Design gym scenarios to verify context.md injection works
- [ ] Build and test the full flow: finish(context_updates) → context.md → next session sees it

## Infrastructure
- [ ] Remove stale memory JSONL injection (replace with context.md)
- [ ] Add prompt size logging to daily digest
- [ ] Common-sense.md V4 (Think-only, 1.1KB) — optimizer proved safe, not yet shipped
