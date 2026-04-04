# DESIGN: Heartbeat-Only Knowledge Injection

**Author**: Tech-Lead  
**Date**: 2026-04-04  
**Status**: Implementing  
**Grounded in**: H-043, PROPOSAL-knowledge-consumability.md (item #3), Hao's constraint

---

## Decision

Knowledge injection happens ONLY in heartbeat sessions. Not in delegated tasks, chat sessions, or cron jobs.

**Rationale** (from Hao): Heartbeats are the natural "briefing" moment where agents orient and decide what to do. Injecting KE summaries into task sessions would feel out of place. For delegated tasks, the dispatcher already includes relevant context in the task description manually.

## Architecture

### Detection: How We Know It's a Heartbeat

All heartbeat cron entries use the `[heartbeat]` prefix in their task message. This is a reliable convention enforced by the cron system:

```json
{ "type": "heartbeat", "message": "[heartbeat] Read agents/bob/heartbeat.md ..." }
```

We detect heartbeats by checking `taskText.startsWith("[heartbeat]")` in `buildSessionContext()`. This is simpler and less invasive than threading a flag through RunOptions.

**Alternative considered**: Adding `isHeartbeat?: boolean` to RunOptions. Rejected because:
- Requires changes to cron.ts, manager-utils.ts, and manager.ts
- The `[heartbeat]` prefix is already a reliable convention — all 10 heartbeat entries use it
- If someone adds a non-heartbeat task starting with `[heartbeat]`, they'd get knowledge injection, which is harmless

### Routing: Static Keyword + Agent-Profile Matching

Two complementary layers, combined:

1. **Agent profile** (always-inject for heartbeats): Each KE entry specifies which agents it's relevant to via `agents: ["tech-lead", "coach"]` or `agents: ["*"]` for universal entries. During heartbeats, the agent's profile entries are always considered.

2. **Keyword matching** (task-inject): The task text is scanned for keywords from the knowledge index. Matching entries boost their score.

For heartbeat sessions, both layers work together. The heartbeat message typically mentions the agent's heartbeat.md file and any injected pending tasks, so keyword matching captures task-relevant knowledge while the agent filter captures role-relevant knowledge.

```
Injected = (entries matching agent profile) ∩ (entries matching keywords)
         ∪ (entries matching agent profile with high base relevance)
```

In practice: entries need both agent relevance AND keyword match to be injected. This prevents flooding agents with all "their" entries every heartbeat.

### Format: One-Liners in User Message

Injection goes in the first user message (session context section), NOT the system prompt. This preserves KV-cache discipline (P147).

Format (per Optimizer's request — brief pointers, not summaries):

```markdown
## Relevant Knowledge (auto-matched from task)
- **KE-007**: Workflow enforcement is the ONLY reliable behavioral intervention — 5/56 experiments promoted, all structural (→ knowledge/entries/KE-007.md)
- **KE-015**: Decision topology R predicts workflow effectiveness — workflows help when R > 0.5, hurt when R < 0.3 (→ knowledge/entries/KE-015.md)
```

### Budget: 2KB Hard Cap

Per my earlier analysis, knowledge injection should add no more than 2KB (~500 tokens) per session. Each entry's one-liner is ~120 bytes. At 3-5 entries, total injection is 400-700 bytes — well within budget.

The `maxResults` parameter (default: 3) controls how many entries are injected. This is the enforcement mechanism.

## What Exists Already

| Component | Status | Location |
|-----------|--------|----------|
| Knowledge index (19 entries with keywords, one-liners, agent tags) | ✅ Complete | `agents/shared/knowledge/knowledge-index.json` |
| Knowledge router (keyword matching, scoring, formatting) | ✅ Complete | `src/lib/knowledge-router.ts` |
| Integration into buildSessionContext | ⚠️ Needs fix | `src/lib/manager.ts` line 604 |

### What Needs to Change

**The only code change**: Add a heartbeat gate to the existing injection point in `buildSessionContext()`.

Current code (fires for ALL sessions):
```typescript
if (taskText && def.projectRoot) {
  const knowledgeBlock = routeKnowledge(def.projectRoot, taskText, agentName, 3);
  if (knowledgeBlock) {
    ctxLines.push(``, knowledgeBlock);
  }
}
```

New code (fires only for heartbeats):
```typescript
const isHeartbeat = taskText?.startsWith("[heartbeat]") ?? false;
if (isHeartbeat && taskText && def.projectRoot) {
  const knowledgeBlock = routeKnowledge(def.projectRoot, taskText, agentName, 3);
  if (knowledgeBlock) {
    ctxLines.push(``, knowledgeBlock);
  }
}
```

## Trade-Offs

### Why heartbeat-only (not all sessions)?

| Factor | Heartbeat-only | All sessions |
|--------|---------------|-------------|
| Relevance | High — heartbeats are planning/orienting moments | Mixed — delegated tasks have specific scope |
| Noise risk | Low — 3 one-liners during orientation | Medium — could distract from focused tasks |
| Token cost | ~500 bytes × ~50 heartbeats/day = 25KB/day | ~500 bytes × ~200 sessions/day = 100KB/day |
| Dispatcher control | Heartbeat = uncontrolled; injection fills a real gap | Delegated tasks = dispatcher already curates context |
| Semantic fit | "Here's what you should know today" = natural briefing | "BTW, here's some knowledge" = awkward in task context |

### Why keyword matching (not LLM classifier)?

- **Zero latency, zero cost**: No API call needed. Pure string matching.
- **Deterministic**: Same input → same output. No non-determinism from LLM.
- **Sufficient at our scale**: 19 entries with 3-8 keywords each. This isn't a 10K-document retrieval problem.
- **No circular dependency**: An LLM classifier would itself need knowledge about how to classify — turtles all the way down.

### Why NOT separate KE summary files?

The original plan called for `summaries/KE-001-summary.md` files. Instead, we put one-liners directly in `knowledge-index.json`. Benefits:
- Single file to maintain (not 19 separate files + an index)
- Atomic updates (change keyword + one-liner together)
- The one-liner format (1 sentence) is exactly what agents want (per Optimizer: "one-liners, not summaries")

### Maintenance burden

The `knowledge-index.json` file needs updating when:
- A new KE entry is verified → add an entry with keywords and one-liner
- An existing entry's keywords prove inadequate → add more keywords
- Agent roles change → update `agents` arrays

This is ~5 minutes of work per new entry. Bob or Coach can do it during their synthesis passes.

## Verification Plan

1. **Compile check**: `npm run check` passes
2. **Unit test**: Test the router with mock entries — verify keyword matching, agent filtering, and formatting
3. **Integration check**: Simulate a heartbeat task and verify knowledge block appears in session context; simulate a delegated task and verify it does NOT appear
4. **Live observation**: After deployment, check 5 heartbeat sessions and confirm knowledge injection appears in the session JSONL

## Connection to Broader Knowledge Consumability Plan

This implements **Proposal item #3** (lightweight knowledge router) from Bob's PROPOSAL-knowledge-consumability.md.

It does NOT implement:
- Item #1 (context.md promotion) — Bob owns this
- Item #2 (INDEX.md summary) — Bob owns this
- Item #4 (KE→workflow gate conversion) — separate track, requires per-KE design
- Item #5 (WKWA synthesis) — Bob's ongoing work

Expected impact: **P(access) for 19 KE entries goes from ~0.05 (agents must manually navigate to files) to ~0.60 (entries are in the prompt during heartbeats)**. Combined with agent profile filtering, irrelevant entries are suppressed, keeping P(false positive) low.

---

*DESIGN-heartbeat-knowledge-injection.md | Tech-Lead | 2026-04-04*
