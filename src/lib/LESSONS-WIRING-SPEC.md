# Lessons Integration Wiring — Implementation Spec

**Status**: Ready for implementation  
**Requires**: Access to `src/lib/manager.ts` (outside agents/ workspace)  
**Module**: `agents/src/lib/lessons.ts` (tested, 9/9 passing)

## What Needs Wiring

### 1. Post-Session: Extract Lessons

**Where**: The session completion handler — wherever `finish()` results are processed.

```typescript
import { extractLessons } from "../agents/src/lib/lessons.ts";

// After finish() is called and session ends:
async function onSessionComplete(session: {
  agent: string;
  task: string;
  finishOutput: FinishOutput;
}) {
  extractLessons(
    AGENTS_ROOT,          // e.g., "/app/agents"
    session.agent,        // e.g., "coder"
    session.task,         // task description
    session.finishOutput  // the finish() call data
  );
}
```

**What it does**: Persists lessons from `finish().lessons` and auto-extracts from `finish().blockers` on failure. Deduplicates against existing lessons. Cross-agent shares patterns/insights.

### 2. Session Start: Retrieve Lessons

**Where**: `buildSessionContext()` — wherever the session prompt is assembled.

```typescript
import { retrieveLessons } from "../agents/src/lib/lessons.ts";

// During buildSessionContext():
const lessonsBlock = retrieveLessons(AGENTS_ROOT, agentName, taskDescription);
// lessonsBlock is a formatted string like:
// "## Lessons from Experience\n\n- [fix] Always run npm install before build\n"
// Append to system/user message
```

**What it does**: Reads agent-specific + shared lesson pools, scores by relevance to current task, returns top-k within 2KB budget.

### 3. Periodic: Decay Old Lessons

**Where**: Heartbeat or daily cron.

```typescript
import { decayLessons } from "../agents/src/lib/lessons.ts";

// During heartbeat or daily maintenance:
decayLessons(AGENTS_ROOT, agentName);
```

**What it does**: Applies confidence decay (7-day half-life) to old lessons, removes below threshold.

## Storage Format

Lessons stored as JSONL at `agents/<name>/lessons.jsonl`:
```jsonl
{"id":"uuid","timestamp":"2026-04-20T...","agent":"coder","category":"fix","text":"...","source_task":"...","confidence":1.0,"validated_count":0,"last_relevant":"2026-04-20T..."}
```

Shared lessons at `agents/shared/lessons.jsonl`.

## Testing

```bash
cd agents && node --experimental-strip-types test/lessons.test.ts
# 9/9 pass
```

## What's NOT Needed

- No LLM calls for extraction — lessons come from the agent's own `finish()` output
- No new tools — agents already report lessons via `finish({ lessons: [...] })`
- No database — plain JSONL files
- No new dependencies

## Future Enhancement: LLM Reflection

The `extract-reflection.js` module (in workspace) adds LLM-based lesson extraction from session transcripts. This is Phase 2 — run after the basic wiring proves value.
