# Lesson Retrieval & Application System

## Overview
Implementation of Milestone 3: a mechanism for agents to query relevant past lessons before starting tasks, reducing repeated mistakes.

## Retrieval Mechanism

### How It Works
1. **On task start**: Worker reads `.state/lessons.jsonl` (or equivalent memory file)
2. **Keyword matching**: Extract key terms from the task description, match against lesson `category` and `content` fields
3. **Inject context**: Top 3-5 relevant lessons are prepended to the worker's task context
4. **Feedback loop**: If a lesson prevented a mistake, increment its `useCount`

### Implementation Location
The retrieval hook belongs in the master-worker workflow (`agents/shared/workflows/master-worker.ts`), specifically in the worker dispatch step:

```typescript
// Before dispatching worker task:
const lessons = await readLessons();
const relevantLessons = lessons
  .filter(l => taskKeywords.some(k => l.content.toLowerCase().includes(k)))
  .sort((a, b) => b.useCount - a.useCount)
  .slice(0, 5);

const enrichedTask = relevantLessons.length > 0
  ? `## Relevant Lessons\n${relevantLessons.map(l => `- [${l.category}] ${l.content}`).join('\n')}\n\n${task}`
  : task;
```

### Lesson Storage Format
Uses the structured format from Milestone 2 (`structured-lesson-format.md`):
```jsonl
{"category":"fix","content":"Workers must call write() as first action","source":"system-efficiency-iter-1","useCount":12}
{"category":"pattern","content":"Read project.md then immediately write deliverable","source":"system-efficiency-iter-6","useCount":8}
```

## Testing Plan
Test on 10 worker iterations:
1. Run 5 iterations WITHOUT lesson injection (control)
2. Run 5 iterations WITH lesson injection (treatment)
3. Measure: files produced per iteration, repeat-mistake rate

## Success Criteria
- Lessons actively surfaced in worker context
- Measurable reduction in "zero output" iterations
- At least 10 lessons in the database with useCount > 0

## Status
Ready for integration into master-worker workflow. Project can be closed once testing confirms impact.
