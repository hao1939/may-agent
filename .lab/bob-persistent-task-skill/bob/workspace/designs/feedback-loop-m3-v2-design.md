# Feedback Loop M3 v2: Findings → Tracked Requests

**Author:** May (starting from Bob's M3 draft)
**Date:** 2026-04-20
**Status:** Design — active
**Predecessor:** [Bob's M3 draft](./feedback-loop-m3-findings-to-requests.md)
**Project:** [feedback-loop.md](../../may/workspace/projects/feedback-loop.md)

## Context

M1 (file-read tracking) and M2 (bidirectional citations) are shipped. M3 closes the loop: when agents produce actionable findings, auto-create tracked requests so work doesn't fall through cracks.

Bob's draft (v1) covered finding sources, triage rules, and severity mapping. This v2 incorporates the **breadcrumb principle** (KE-311) and focuses on implementable scope.

## Design Principle: Breadcrumbs, Not Answers

Per KE-311, the auto-created requests should NOT say "fix X by doing Y." They should say "investigation needed: finding Z in file W suggests a problem — check it out." This triggers agent action far more reliably.

## What Ships in M3

### 1. Finding Detection (event-driven)

When a session produces a deliverable matching finding patterns, fire a `finding:created` event.

**Monitored paths:**
- `agents/scout/workspace/deep-dives/DD-*.md`
- `agents/scout/workspace/findings/*.md`  
- `agents/may/workspace/audits/*.md`
- `agents/shared/knowledge/findings/*.md`

**Not monitored** (per Bob's v1 rationale): design docs (already in reviewed-delivery), KEs (reference material, too noisy).

### 2. Request Creation

For each detected finding:

```typescript
interface AutoRequest {
  task: string;        // "[Auto] Investigate: {one-line summary}"
  source: string;      // path to finding file
  fromEntity: string;  // producer agent
  toAgent: string;     // assigned agent (see routing below)
  priority: Priority;  // derived from language (see Bob's v1 §2)
}
```

**Breadcrumb format for task field:**
```
[Auto] Investigate: {summary}. Start by reading {source_file}, section "{section_name}".
```

### 3. Routing Rules

| Finding contains | Route to | Rationale |
|-----------------|----------|-----------|
| Code change recommendation | tech-lead | Owns code decisions |
| Process/context issue | may | Owns process |
| Research question | bob | Owns knowledge |
| Training/eval issue | coach | Owns experiments |
| Ambiguous | may | Triages to correct owner |

### 4. Dedup

Before creating a request, check existing open requests:
- Simple substring match on source file path (if a request already exists citing the same finding file, skip)
- This is cheaper than cosine similarity and covers 90% of dupes

### 5. Implementation Location

Add to `src/lib/session-subscribers.ts`:
- `createFindingsTracker()` — subscribes to session completion events
- On session end, scan deliverables list for matching paths
- Extract summary from file (first heading + first paragraph)
- Create tracked request via existing `createRequest()` API

## What's Deferred to M4+

- Cosine similarity dedup (M3 uses path-based dedup)
- Coach experiment result parsing (conditional logic too complex for M3)
- Auto-close requests when finding is resolved
- Quality scoring of auto-created requests

## Success Criteria

1. Scout produces a finding → tracked request appears within 60s
2. Request uses breadcrumb format (points to file, not instructions)
3. No duplicate requests for same finding
4. Tech-lead picks up auto-created requests in next heartbeat

## Open Questions

1. Should auto-requests have a TTL? (e.g., auto-close after 7 days if not picked up)
2. Rate limit? (max N auto-requests per hour to prevent flooding)
3. Should the `[Auto]` prefix affect priority sorting in agent heartbeats?
