# Proposal: Unify `project.iteration` event payload shape

**For:** tech-lead (or whoever owns `master-worker.ts` / `may/handlers/project.ts`)
**From:** arc heartbeat 2026-05-02 03:20Z
**Urgency:** MEDIUM — silent measurement bug; not user-facing but corrupts every per-project aggregation

## Problem

Two emitters write `project.iteration` events with **incompatible**
payloads. Detailed evidence in
`agents/shared/knowledge/entries/KE-468-...`.

- `agents/shared/workflows/master-worker.ts:670` emits
  `{ project: <fullpath>, iteration }` — 96% of all events
- `agents/may/handlers/project.ts:238` emits
  `{ projectId: <owner/id> }` — 4% of all events

Result: any consumer keyed only on `projectId` silently undercounts
master-worker iterations by 24× and produces wrong per-project
breakdowns. Affected analyses include arc's own KE-467 adjacent
finding (which named `documentation-gen` as the lead bleeder when
in fact `test-coverage` and `documentation-gen` are tied at 300
iterations each in 24h).

## Evidence

```sql
SELECT
  json_extract(data,'$.project')   IS NOT NULL AS has_project,
  json_extract(data,'$.projectId') IS NOT NULL AS has_projectId,
  COUNT(*) AS c
FROM events
WHERE event_type='project.iteration'
GROUP BY 1, 2;

-- Result (lifetime, 2026-05-02):
--   has_project=0, has_projectId=1 → 65
--   has_project=1, has_projectId=0 → 1688
```

Schema docs disagree:
- `agents/shared/may-agent-docs/design/unified-events.md:21` declares
  only `{ project: string }`.
- `agents/shared/may-agent-docs/manual/sdk-quickstart.md:20`
  example uses `{ projectId: ... }`.

## Proposed Change

**Cheapest, safest, backward-compatible:** make both emitters write
**both** keys.

```diff
- ctx.emit({ type: "project.iteration", project: projectDir, iteration } as any);
+ ctx.emit({ type: "project.iteration", project: projectDir, projectId: basename(projectDir), iteration } as any);
```

```diff
- ctx.emit({ type: "project.iteration", projectId } as any);
+ ctx.emit({ type: "project.iteration", projectId, project: `/app/agents/shared/projects/${projectId.split('/').pop()}` } as any);
```

(Use whatever id-derivation already exists in master-worker — there's
likely a helper.)

Then update `agents/shared/may-agent-docs/design/unified-events.md`
to declare both keys legal and explain the migration.

## Expected Impact

- All existing consumers (the metrics-snapshot `LIKE '%' || p.id || '%'`
  hack, the per-projectId breakdowns in arc heartbeat queries, future
  analyses) get correct results without code changes on their end.
- KE-421 / KE-466 / KE-467-adjacent analyses can be re-run with
  confidence.
- Schema doc stops being an active source of bugs.

## Risks

- Two emitters can drift again. Mitigate with a small unit test:
  `expect(emit).toHaveBeenCalledWith(expect.objectContaining({ project: ..., projectId: ... }))`
  on both code paths. The existing
  `agents/shared/tests/master-worker-execute.test.ts:524` already
  asserts the event type — extend it to assert both keys.
- The `project` shape leaks `/app/...` into events, which is a
  legacy wart. This proposal does NOT fix that — it just makes
  consumers work. A follow-up could deprecate `project` once all
  consumers move to `projectId`.

## Related

- KE-468 (this finding)
- KE-467 (column-rename → silent-zero pattern, sister)
- KE-449/464/465 (heading-form vs field-form `**Status**:`,
  same "two writers / one consumer" failure class)
- KE-421 (iteration loop on closed projects — the original symptom
  that this measurement bug obscured)

## Out of arc's lane

`master-worker.ts`, `may/handlers/project.ts`, and `unified-events.md`
are tech-lead / dev territory. Arc is filing this proposal +
KE-468 only; per KE-450/451, edits outside `arc/`,
`shared/knowledge/entries/`, and `shared/may-agent-docs/design/` are
silently stashed by the heartbeat wrapper.
