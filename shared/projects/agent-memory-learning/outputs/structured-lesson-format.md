# Structured Lesson Capture — Design & Initial Database

## Standard Lesson Format

Each lesson is a JSON object with these fields:

```json
{
  "id": "lesson-<timestamp>-<hash>",
  "category": "fix | pattern | insight",
  "content": "Specific, actionable lesson text",
  "source_session": "session ID or date",
  "agent": "worker | orchestrator | planner",
  "project": "project name if applicable",
  "created": "ISO 8601 timestamp",
  "tags": ["workflow", "output", "debugging", ...]
}
```

### Category Definitions
- **fix**: A bug/error encountered and how it was resolved
- **pattern**: A reusable approach worth remembering across sessions
- **insight**: An observation about the system, codebase, or workflow

### Storage
- Lessons stored in `agents/<name>/context.md` via `finish()` context_updates
- Bulk lessons stored in `agents/shared/lessons.jsonl` (one JSON per line)
- Queryable by category, agent, project, or tags

## Initial Lesson Database (from recent sessions)

### Lessons Extracted

1. **fix**: Workers that read/analyze before writing burn iterations without output. Fix: always write() first.
2. **pattern**: Master-worker workflow already has output verification — use `requiresOutput: true` flag.
3. **insight**: ~70 agent-owned projects accumulated as zombies with 500+ consecutive skips — periodic archival needed.
4. **fix**: Project.md files in agent-owned directories don't always exist — check before reading.
5. **pattern**: Copying deliverables to both project-specific and shared outputs directories ensures visibility.
6. **insight**: Only ~3 of 5 active projects were producing deliverables — project count alone doesn't indicate throughput.
7. **pattern**: Workflow error patterns cluster around timeout, context overflow, and tool failures — monitor these three categories.
8. **fix**: Context_updates in finish() are the primary mechanism for cross-session memory — use them consistently.
9. **insight**: Deliverables-per-day is a better throughput metric than iterations-per-day.
10. **pattern**: New projects need explicit first milestones that produce a concrete file to avoid stalling.

## Integration with Worker Completion Flow

The `finish()` tool already supports `lessons` and `context_updates` fields. To systematize:

1. **Every worker iteration** must include at least one lesson in `finish()` 
2. **Orchestrator** reviews lessons weekly and promotes high-value ones to shared context
3. **Before task start**, agents check `agents/shared/lessons.jsonl` for relevant prior lessons (future milestone 3)

## Next Steps (Milestone 3)
- Create `agents/shared/lessons.jsonl` with the 10 lessons above in JSON format
- Build a retrieval prompt snippet that injects relevant lessons into worker task descriptions
- Test on 10 iterations and measure repeat-mistake reduction
