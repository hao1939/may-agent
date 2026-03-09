# Exercise 2 Review Target: Rolling Compaction Design

## Context
The system uses rolling compaction to manage agent memory files. Each agent's
`.state/memory/<agent>.jsonl` grows over time. The compaction process:
1. Reads all entries from the JSONL file
2. Groups entries by topic/task
3. Summarizes groups that exceed a size threshold  
4. Writes the compacted result back

## Current Design (from `src/compaction.ts`)

### Entry Format
```typescript
interface MemoryEntry {
  task: string;
  status: "done" | "error" | "skipped";
  duration: string;
  summary: string;
  timestamp: number;
  compacted?: boolean;  // true if this is a compaction summary
}
```

### Compaction Trigger
- Runs when memory file exceeds 50 entries
- Targets entries older than 7 days
- Keeps the 10 most recent entries untouched ("hot zone")

### Compaction Strategy
- Groups entries by `task` field prefix (before first `:`)
- Summarizes groups of 5+ entries into a single compacted entry
- Preserves the best summary from the group (longest one)
- Deletes individual entries after compaction

## Design Questions for Bob

Answer ALL of these in your review:

1. **Philosophy Fit**: Does the "longest summary = best summary" heuristic align with
   our design principles? Which principle is most relevant?

2. **Data Loss Risk**: The current design deletes originals after compaction. Is this
   safe? What's the failure mode if compaction produces a bad summary?

3. **Hot Zone Size**: Is 10 entries the right size for the "hot zone" (untouched recent
   entries)? What should determine this number?

4. **Grouping Strategy**: Grouping by task prefix (before `:`) means all cron tasks of
   the same type get grouped together. Is this right, or should we group differently?

5. **Missing Safeguard**: What safeguard is missing from this design that our philosophy
   principles would predict we need?

## Instructions

- Write your review to: `agents/bob/workspace/compaction-design-review.md`
- Answer ALL 5 questions above
- Reference specific philosophy principles by number (e.g., P1, P5, P19)
- Do NOT delegate to optimizer or coder — this is a review, not implementation
- Do NOT create any files other than the one specified above
- Do NOT modify the compaction code or any other files
