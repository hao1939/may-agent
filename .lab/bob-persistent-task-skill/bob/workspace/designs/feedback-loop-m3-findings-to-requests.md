# Feedback Loop M3: Findings → Tracked Requests Auto-Creation

**Author:** Bob  
**Date:** 2026-04-18  
**Status:** Draft — for tech-lead review  
**Context:** M1 (file-read tracking) and M2 (bidirectional citations) are shipped. This is M3.  
**Project:** agents/may/workspace/projects/feedback-loop.md

## Problem

Agents produce actionable findings that require follow-up work, but nothing connects the finding to a tracked request. Scout writes "agent X has pattern Y — should fix Z" and it sits in a .md file. Tech-lead has specifically asked for this automation.

## 1. Finding Sources

| Source | Path pattern | Producer | Frequency | Auto-create? |
|--------|-------------|----------|-----------|-------------|
| Scout deep-dives | `agents/scout/workspace/deep-dives/DD-*.md` | scout | ~5/day | **Yes** — most contain explicit recommendations |
| Scout findings | `agents/scout/workspace/findings/*.md` | scout | ~2/day | **Yes** — these are already structured |
| Bob design docs | `agents/bob/workspace/designs/*.md` | bob | ~1/day | **No** — designs already go through reviewed-delivery workflow |
| May audit reports | `agents/may/workspace/audits/*.md` | may | ~1/week | **Yes** — audits often surface agent issues |
| Coach experiment results | `knowledge/experiments/EXP-*/results.md` | coach | ~2/day | **Conditional** — only when results contain "recommendation" or "action" sections |
| Knowledge entries | `knowledge/entries/KE-*.md` | varies | ~3/day | **No** — KEs are reference material, not action items. Occasionally they note "should do X" but this is too noisy to auto-track. |

**Rationale for exclusions:** Design docs already enter the request system via `reviewed-delivery` workflow. KEs are passive knowledge — tracking them all would flood the request queue.

## 2. Triage Rules

A finding should become a tracked request when ALL of:

1. **Actionable**: Contains a concrete next step (not just an observation). Heuristic: text contains imperative language ("should", "must", "fix", "add", "implement", "change") in a recommendations/action-items section.
2. **Assigned**: Can determine a target agent. Mapping:
   - Code changes → tech-lead
   - Context/process changes → may
   - Research follow-ups → bob
   - Scenario/training work → coach
   - Default (ambiguous) → may (for triage)
3. **Not duplicate**: No existing open request with >0.7 cosine similarity on task text (see §4).
4. **Fresh**: Finding was produced in the current session (not a re-read of old content).

### Severity mapping

Findings don't have explicit severity, so derive it from language:
- **P0**: "breaking", "blocks", "regression", "data loss" → creates request immediately
- **P1**: "should fix", "bug", "incorrect" → default
- **P2**: "nice to have", "consider", "minor" → creates request but low priority

### Request format

```
task: "[Auto] {one-line summary from finding}"
source: "{path to finding file}"
fromEntity: "{producer agent}"  
toAgent: "{assigned agent}"
context: "Auto-created from finding. See source file for details."
```

The `[Auto]` prefix lets agents and humans distinguish auto-created requests from manual ones.

## 3. Implementation Sketch

### Where it hooks in

**`src/lib/session-subscribers.ts`** — new subscriber: `createFindingsTracker()`

This subscriber listens for `session_end` events. When a session's `deliverables` array (from `finish()`) includes files matching the source patterns in §1, it:

1. Reads each deliverable file
2. Extracts recommendation/action sections (regex for `## Recommend`, `## Action`, `## Next`, `### Should`)
3. Applies triage rules
4. Calls `trackRequest()` from `requests.ts` for each qualifying action item

**Why session_end, not file-write?** Because:
- We already have the event bus wired for session_end
- deliverables list is available in finish() params
- Avoids triggering on intermediate file writes (drafts, partial saves)

### Wiring

In `src/app/may.ts`, add:
```ts
bus.subscribe(createFindingsTracker(projectRoot));
```

Same pattern as `createContextUpdater` and `createFileReadTracker`.

### DB schema change

Add a `source_finding` column to the existing `requests` table:

```sql
ALTER TABLE requests ADD COLUMN source_finding TEXT;
```

This stores the path to the originating finding file. Used for:
- Duplicate detection (don't create request if one already exists for same source file)
- Traceability (tech-lead can see why a request was created)
- M2 bidirectional citations (the finding now links forward to the request)

**No new table needed.** The `requests` table already handles everything; we just need to mark auto-created ones.

### Extraction logic (pseudocode)

```ts
function extractActionItems(content: string, filePath: string): ActionItem[] {
  const sections = content.split(/^##\s+/m);
  const actionSections = sections.filter(s => 
    /^(Recommend|Action|Next Step|Should|Fix|TODO)/i.test(s)
  );
  
  // Each bullet point in an action section = one potential request
  const items = [];
  for (const section of actionSections) {
    const bullets = section.match(/^[-*]\s+.+$/gm) || [];
    for (const bullet of bullets) {
      items.push({
        summary: bullet.replace(/^[-*]\s+/, ''),
        source: filePath,
        severity: deriveSeverity(bullet),
        targetAgent: deriveAgent(bullet),
      });
    }
  }
  return items;
}
```

## 4. Edge Cases

### Duplicate detection

**Primary:** Before creating a request, query:
```sql
SELECT requestId FROM requests 
WHERE source_finding = ? AND status NOT IN ('COMPLETED', 'FAILED')
```
If a match exists for the same source file, skip.

**Secondary (fuzzy):** For different source files that recommend the same thing, use simple token overlap: normalize task text → split into words → Jaccard similarity > 0.7 → skip. Full embedding similarity is overkill for this volume (~5-10 findings/day).

### Staleness

- Only process deliverables from the *current session's* finish() call — never scan old files
- If a finding file has `status: stale` or `status: superseded` in frontmatter, skip it
- Auto-created requests that sit CREATED for >7 days get auto-escalated to may via a simple cron check (can piggyback on existing may heartbeat)

### Agent self-requests

- Allowed but flagged: if `fromEntity === toAgent`, add `[self-request]` tag
- This is legitimate (scout finds something scout should investigate further) but may should review self-requests in audits to catch loops

### Volume control

- Cap at 5 auto-created requests per session to prevent a single noisy finding from flooding the queue
- If a session would create >5, create the top 5 by severity and log a warning

### Malformed findings

- If extraction finds zero action items in a deliverable, silently skip (most common case — not all deliverables are findings)
- If a deliverable file doesn't exist or can't be read, log warning and skip

## 5. Rollout Plan

1. **Phase 1**: Deploy with `[Auto]` prefix and P2 default priority. May reviews all auto-created requests in first week.
2. **Phase 2**: After validation, promote to normal priority. Add severity derivation.
3. **Phase 3**: If working well, expand to KEs that have explicit `## Action` sections.

## 6. Success Metrics

- **Coverage**: >80% of scout findings that contain recommendations get a tracked request
- **Precision**: <20% of auto-created requests get closed as "not actionable" by the assignee
- **Latency**: Request created within same session as finding (no manual step)
- **No regression**: Request queue doesn't grow unboundedly (volume control + duplicate detection)
