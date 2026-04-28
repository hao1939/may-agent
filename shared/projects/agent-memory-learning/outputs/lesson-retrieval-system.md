# Lesson Retrieval System Design & Implementation

## Overview
A mechanism for agents to query relevant past lessons before starting tasks, reducing repeated mistakes and improving output quality.

## Retrieval Architecture

### Storage: `.state/lessons.json`
```json
[
  {
    "id": "lesson-001",
    "category": "fix",
    "content": "Workers must call write() as first tool call — reading/analyzing first burns iterations",
    "source": "system-efficiency iteration 1-4",
    "tags": ["worker", "output", "instruction-following"],
    "created": "2025-01-27"
  },
  {
    "id": "lesson-002", 
    "category": "pattern",
    "content": "Cycling iterations across multiple projects sustains throughput better than deep-diving one project",
    "source": "system-efficiency iteration 6-20",
    "tags": ["throughput", "project-management"],
    "created": "2025-01-27"
  },
  {
    "id": "lesson-003",
    "category": "fix",
    "content": "Zombie projects with 500+ consecutiveSkips should be archived — they add noise to project lists",
    "source": "system-efficiency iteration 2",
    "tags": ["cleanup", "projects"],
    "created": "2025-01-27"
  }
]
```

### Query Function
```typescript
function retrieveLessons(taskDescription: string, limit: number = 5): Lesson[] {
  const lessons = JSON.parse(fs.readFileSync('.state/lessons.json', 'utf8'));
  const taskWords = taskDescription.toLowerCase().split(/\s+/);
  
  // Score each lesson by tag/content overlap with task description
  const scored = lessons.map(lesson => {
    const matchScore = lesson.tags.filter(tag => 
      taskWords.some(word => word.includes(tag) || tag.includes(word))
    ).length;
    const contentScore = lesson.content.toLowerCase().split(/\s+/)
      .filter(w => taskWords.includes(w)).length;
    return { lesson, score: matchScore * 3 + contentScore };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.lesson);
}
```

### Integration Points
1. **Worker session start**: Query lessons matching the task description, inject top 3 into system prompt
2. **Worker session end**: Extract new lessons from `finish()` call's `lessons` field, append to lessons.json
3. **Orchestrator planning**: Query lessons matching project goals before writing iteration guidance

## Lessons Captured So Far (from this project session)

| # | Category | Lesson | Source |
|---|----------|--------|--------|
| 1 | fix | Workers announce intent but don't execute — must require write() first | system-efficiency iter 1-4 |
| 2 | pattern | Read project.md → write deliverable is the most reliable worker pattern | system-efficiency iter 6-11 |
| 3 | insight | 5 active projects with round-robin iterations sustains high throughput | system-efficiency iter 15-20 |
| 4 | fix | Zombie projects accumulate silently — need periodic archival sweeps | system-efficiency iter 2 |
| 5 | pattern | finish() with deliverables list enables verification of worker output | workflow-reliability iter 1-3 |

## Impact Measurement Plan
- Run 10 worker iterations with lesson injection enabled
- Compare: iterations-with-output rate before (55%) vs after (target: 85%+)
- Track: repeat-mistake occurrences per week (target: <2)

## Status
Ready for implementation. The retrieval function can be added to the worker initialization flow in `agents/shared/workflows/master-worker.ts`.
