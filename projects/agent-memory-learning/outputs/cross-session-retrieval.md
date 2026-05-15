# Cross-Session Memory Retrieval System

## Overview
Agents need to query lessons and context from previous sessions without reading entire checkpoint histories. This design provides a structured retrieval API.

## Storage Format

### Lesson Records (`/.state/lessons/`)
```json
{
  "id": "lesson-2025-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "category": "fix|pattern|insight",
  "agent": "worker|orchestrator|scanner",
  "project": "workflow-reliability",
  "content": "master-worker.ts already has output verification; no need to add it",
  "tags": ["workflow", "verification", "existing-feature"],
  "confidence": 0.9,
  "times_retrieved": 3
}
```

### Index File (`/.state/lessons/index.json`)
```json
{
  "by_project": { "workflow-reliability": ["lesson-2025-001", "lesson-2025-003"] },
  "by_category": { "fix": ["lesson-2025-001"], "pattern": ["lesson-2025-002"] },
  "by_agent": { "worker": ["lesson-2025-001", "lesson-2025-002"] }
}
```

## Retrieval API

### 1. Query by Context
```typescript
function retrieveLessons(query: {
  project?: string;
  category?: "fix" | "pattern" | "insight";
  agent?: string;
  tags?: string[];
  limit?: number;
}): Lesson[]
```

### 2. Query by Similarity
```typescript
function findRelatedLessons(taskDescription: string, limit?: number): Lesson[]
// Uses keyword overlap scoring against lesson content and tags
```

### 3. Auto-Inject on Session Start
```typescript
function getSessionContext(agent: string, project: string): string {
  const projectLessons = retrieveLessons({ project, limit: 5 });
  const agentLessons = retrieveLessons({ agent, category: "fix", limit: 3 });
  return formatAsContext(projectLessons, agentLessons);
}
```

## Scoring Algorithm
When multiple lessons match, rank by:
1. **Recency** (newer = higher, decay over 7 days)
2. **Relevance** (tag overlap with current task)
3. **Confidence** (lessons confirmed by outcomes rank higher)
4. **Retrieval count** (frequently retrieved = proven useful)

Score = `0.4 * recency + 0.3 * relevance + 0.2 * confidence + 0.1 * normalized_retrievals`

## Integration Points
- **Session start**: Auto-inject top 5 relevant lessons into agent context
- **Checkpoint save**: Extract new lessons from checkpoint data, store in index
- **finish() call**: Lessons from `lessons` field auto-persisted to storage
- **Context updates**: `context_updates` field synced to lesson index

## Example Flow
1. Worker starts session for test-coverage project
2. System calls `getSessionContext("worker", "test-coverage")`
3. Returns: "Previous lessons: (1) Coverage baseline shows 23% for handlers — focus there first. (2) Workers must write() before read() to avoid stalling."
4. Worker incorporates lessons, avoids past mistakes
5. At session end, new lessons added to index

## Migration Path
- Phase 1: Manual — agents read `.state/checkpoints/` directly (current state)
- Phase 2: Indexed — build index.json from existing checkpoints
- Phase 3: Auto-inject — hook into session start to provide relevant context
