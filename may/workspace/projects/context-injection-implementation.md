Status: done

# Context Injection Review — Implementation Assessment

**Status**: active
**Iteration**: 2
## Current Architecture (src/lib/manager.ts:538-681)

The `buildSessionContext()` method assembles 9 layers into the **first user message**, with the task appended after a `---` separator (line 1098-1100):

```
promptText = `${sessionContext}\n\n---\n\n${task}`
```

### Layer Inventory

| # | Layer | Lines | Purpose | Approx tokens |
|---|-------|-------|---------|---------------|
| 1 | Session ID + time | 545-546 | Identity | ~30 |
| 2 | Digest history | 548-583 | What happened recently | 200-800 |
| 3 | Active recall | 586-590 | Failure pattern warnings | 0-500 |
| 4 | Last session summary | 594-604 | Cold-start bridge | 100-400 |
| 5 | Session diff | 608-628 | What changed since last run | 0-300 |
| 6 | Checkpoint | 632-645 | Resume persistent tasks | 0-200 |
| 7 | context_files | 649-656 | heartbeat.md, todo.md etc | 500-2000 |
| 8 | context.md | 660-672 | Accumulated knowledge | 500-2000 |
| 9 | Knowledge routing | 676-681 | Task-matched KE pointers | 30-100 |

**Total context before task**: ~1400-6300 tokens. Task itself buried at the end.

---

## Assessment

### 1. Layers That Can Be Removed or Made Conditional

#### Active Recall (layer 3, line 586-590) — REMOVE for non-heartbeat sessions
- **Risk: LOW.** KE-002 showed text rules = 0% compliance. The recalls are behavioral warnings ("avoid X pattern") which agents demonstrably ignore.
- **Evidence**: Tech-lead has 17+ active recall entries (see session context above). Despite this, the same FM-3.3 pattern recurs session after session.
- **Safe change**: Remove entirely. Active recall's purpose (preventing failure repetition) is better served by the evaluator giving specific, bounded instructions via context_updates.
- **Risk mitigation**: Monitor FM recurrence rates for 48h after removal. If rates spike, re-enable selectively for agents with >3 recurring failures.

#### Session Diff (layer 5, line 608-628) — REMOVE
- **Risk: LOW.** Overlaps heavily with digest history (layer 2). Digest history already shows cross-agent activity and recent outcomes. Session diff adds "what sessions ran since your last session" which is redundant.
- **Evidence**: The diff queries the same `sessions` table that digest history uses. Format is less structured (raw session list vs curated digests).
- **Safe change**: Remove entirely. No fallback needed — digest history covers the same ground.

#### Last Session Summary (layer 4, line 594-604) — MAKE CONDITIONAL
- **Risk: MEDIUM.** For heartbeat agents this overlaps with digest history. But for work sessions spawned mid-task, last-session gives critical "here's what I was doing" context that digests don't capture well.
- **Safe change**: Only inject for heartbeat/cron sessions (where digests already cover it). Keep for work sessions.
- **Alternative**: Skip if digest history already contains the same session (check sessionId match).

#### Checkpoint (layer 6, line 632-645) — MAKE CONDITIONAL  
- **Risk: LOW.** Only useful for persistent-task sessions (multi-session projects). Most sessions never read checkpoints. Currently injected unconditionally but usually empty (no checkpoint exists).
- **Safe change**: Already effectively conditional (only injects when checkpoint exists). No change needed — cost is zero when no checkpoint.

### 2. Task Positioning — Move Task FIRST

**Current** (manager.ts:1098-1100):
```
promptText = `${sessionContext}\n\n---\n\n${task}`
```

**Proposed**:
```
promptText = `${task}\n\n---\n\n${sessionContext}`
```

**Risk: LOW-MEDIUM.**
- Anthropic models attend well to the beginning of the user message. Task-first means the model sees *what to do* before *background context*.
- Most agents' heartbeat.md files say "Read X first" — this instruction would now appear before context, which is correct (the instruction to orient comes before the orientation material).
- **What could break**: Agents that reference "the context above" in their task text. Grep check needed.
- **Mitigation**: Search for "above" / "context above" in task-generating code before deploying.

```bash
# Pre-deploy check
scripts/code-search.sh 'above' --path 'agents/**/*.md' -l
```

### 3. context.md Capping

**Current sizes** (estimated):
- may: ~7.5K chars (~2K tokens)
- bob: ~5.2K chars (~1.3K tokens)  
- tech-lead: ~4K chars (~1K tokens)
- coder: ~3K chars (~750 tokens)

**Option A: Cap at 2K chars, prune oldest**
- Risk: HIGH. Oldest entries may be most important (foundational knowledge like "bun is at .state/.bun/bin/bun"). Recency ≠ importance.
- Not recommended without importance scoring.

**Option B: Move to system prompt**
- Risk: LOW. context.md is stable across a session (written only at session end via finish()). Moving it to system prompt enables KV-cache reuse across turns within the same session.
- **Concern**: System prompt is currently kept stable per P147 KV-Cache Discipline (line 481, 510). But context.md *is* stable within a session — it only changes between sessions. So this is cache-compatible.
- **Tradeoff**: System prompt becomes agent-specific (different context.md per agent), but it already is (different system prompts per agent definition).

**Option C: Cap at 2K chars, prune by staleness + low-citation**
- Track which context entries are actually cited in agent outputs. Prune entries never referenced in 7 days.
- Higher complexity, better results. Defer to M4.

**Recommendation**: Option B (move to system prompt) for immediate win. Consider Option C later.

### 4. Minimal Safe Change — Implementation Order

#### Phase 1: Remove session diff (lowest risk, clearest overlap)
```typescript
// manager.ts: DELETE lines 606-629 (session-diff injection block)
```
- **Estimated savings**: 0-300 tokens/session
- **Validation**: Run 24h, compare agent performance metrics

#### Phase 2: Task-first reorder  
```typescript
// manager.ts:1098-1100, change:
const promptText = fewShotBlock
  ? `${task}\n\n---\n\n${sessionContext}\n\n---\n\n${fewShotBlock}`
  : `${task}\n\n---\n\n${sessionContext}`;
```
- **Pre-check**: Grep for "above" references in task-generating code
- **Estimated impact**: Better task adherence (task in primacy position)

#### Phase 3: Remove active recall
```typescript
// manager.ts: DELETE lines 585-591 (active recall block)
// Also: remove runActiveRecall/formatRecallWarnings imports
```
- **Estimated savings**: 0-500 tokens/session
- **Monitor**: FM recurrence rates for 48h

#### Phase 4: Move context.md to system prompt
```typescript
// In buildSystemPrompt() or equivalent: append context.md content
// In buildSessionContext(): remove context.md block (lines 658-673)
```
- **Estimated savings**: Better KV-cache hit rate (context.md tokens cached across turns)
- **Risk**: Must verify system prompt builder accepts per-agent content

#### Phase 5 (deferred): context.md capping with staleness pruning
- Requires citation tracking infrastructure
- Defer to M4

---

## Summary

| Change | Risk | Token savings | Priority |
|--------|------|---------------|----------|
| Remove session diff | LOW | 0-300 | P1 — do first |
| Task-first reorder | LOW-MED | 0 (quality gain) | P2 |
| Remove active recall | LOW | 0-500 | P3 |
| context.md → system prompt | LOW | 0 (cache gain) | P4 |
| context.md capping | HIGH | variable | Defer |

Total estimated savings from P1-P3: 0-800 tokens/session, plus quality improvements from task-first positioning.


## Progress Log

### Iteration 1 — 2026-04-20T10:59:33.124Z
**Worker**: The goal says "see project file" — this project is already complete per DELIVERABLES_CHECKLIST.md. Let me document this finding as my deliverable.



### Iteration 2 — 2026-04-20T11:06:40.603Z
**Worker**: 

The owner/reviewer has marked this task as **DONE**. There's no further work needed.


## Current State
Iteration 2. Milestones: 0/0 done.

