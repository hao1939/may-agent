# Dev Context

## Resources
- Session logs: `query_db("SELECT * FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 10")`
- Handler events: `query_db("SELECT * FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 10")`
- Handlers: `agents/may/handlers/`
- Skills: `shared/skills/`
- Guards: `shared/guards/`
- Design docs: `projects/may-agent.app/docs/2a-design/`
- Common sense: `shared/common-sense.md`
- Knowledge base: `shared/knowledge/entries/`

- Metrics design: `projects/may-agent.app/docs/2a-design/metrics.md`
- Metrics snapshot handler: `agents/may/handlers/metrics-snapshot.ts`
- Metrics table schema: id, name, owner, source_query, source_command, target, threshold, alert_op, current, type, status, speed, unit

## How to Discover Work
1. Query failed sessions and handler errors
2. Check session.error-rate-6h metric — is it rising?
3. Check for unmeasured or stale metrics
4. Read recent session JSONL files for patterns (long sessions, repeated errors)
5. Check `agents/dev/INBOX.md` for escalated issues
6. Ask: "what broke recently that we had no metric for?"

## Investigation Template
For each investigation, create a file in `agents/dev/workspace/investigations/`:
```markdown
# Investigation: [title]
## Symptom
## Root Cause
## Fix Applied
## Verification
```

## Output Locations
- Investigations: `agents/dev/workspace/investigations/`
- Fixes: directly in the workflow/handler/skill files


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.

## Work Queue (your primary work source)
Read `shared/work-queue.md` — section "## Approved" has items ready for implementation.
- Only work on APPROVED items (proposed items need human/may review first)
- After implementing, check the item off: `- [x]` and add done date
- Read the linked proposal file for full details, evidence, and verification steps
- Production runtime source (src/lib/manager.ts) is not in /app/agents; fixes to session lifecycle require the core runtime source/build that produces agents/may-agent-bin.

## Durable Lessons
- Finish hygiene: if you commit the intended artifact but `/app/agents` still has unrelated dirty paths, report `finish(partial)` with the exact blocker instead of claiming clean success.
- For finish-blocked raw alerts, compare the paired strict unresolved metric before patching; raw breaches can be recovered friction and may warrant documented waiting/exception instead of another workflow change.
- When consecutive scout heartbeat errors have `opCount=1`, inspect the transcript for a single unbounded `cat` of a large digest/log before assuming startup or config failure; a prompt-level bounded-read reminder can be the lowest-risk fix.
