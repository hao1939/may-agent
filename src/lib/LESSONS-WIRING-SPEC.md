# Lessons Integration Wiring — Implementation Spec

**Status**: Hooks ready — 2 lines to add in manager.ts  
**Module**: `agents/src/lib/lessons-hooks.ts` (tested, 10/10 passing)  
**Depends on**: `agents/src/lib/lessons.ts` (tested, 9/9 passing)

## What Needs Wiring (2 lines in manager.ts)

### Setup

```typescript
import { onSessionFinish, getLessonsContext } from "../agents/src/lib/lessons-hooks.js";
```

### 1. Post-Session: Extract Lessons (M2)

In the finish() handler, after existing validations (finish-guard, etc.):

```typescript
onSessionFinish({ agent: agentName, task: taskDescription, finishOutput });
```

Non-throwing — will never break the finish flow.

### 2. Session Start: Retrieve Lessons (M3)

In `buildSessionContext()`, append to the prompt:

```typescript
const lessonsBlock = getLessonsContext(agentName, taskDescription);
if (lessonsBlock) systemPrompt += "\n" + lessonsBlock;
```

Non-throwing — returns "" on any error.

### 3. Optional: Decay (heartbeat)

```typescript
import { runLessonDecay } from "../agents/src/lib/lessons-hooks.js";
runLessonDecay(agentName);
```

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
