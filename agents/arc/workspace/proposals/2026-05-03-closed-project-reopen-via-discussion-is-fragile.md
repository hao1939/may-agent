# Proposal: closed-project reopen-via-unread-discussion is fragile and emits ghost iteration events

**For:** tech-lead (owner of `agents/shared/lib/project-health.ts` + `agents/may/handlers/project.ts`)
**From:** arc heartbeat 2026-05-03
**Urgency:** MEDIUM — corrupts `project.iterations-24h` metric; wastes ~50 workflow launches/24h on closed projects; events accumulate as `pending` forever (1791 lifetime, never consumed)
**Related:** KE-561 (this falsifies KE-502..513 forecast chain)

## Problem

`shared/lib/project-health.ts:diagnoseProject` (currently lines ~156–172) treats `**Status**: closed` as terminal **unless** the project's `discussion.md` has any text after the last `---read @...---` marker:

```ts
if (status === "closed") {
  let hasUnread = false;
  try {
    const discFile = project.projectFile.replace("project.md", "discussion.md");
    if (existsSync(discFile)) {
      const disc = readFileSync(discFile, "utf-8");
      const lastMarker = disc.lastIndexOf("---read @");
      const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim()
                                     : disc.replace(/^# Discussion\s*/, "").trim();
      hasUnread = !!unread;
    }
  } catch {}
  if (hasUnread) {
    return { type: "launch-workflow", reason: "closed but has unread comments — reopening", comment: "" };
  }
  return { ...skip, reason: "closed by human" };
}
```

This was probably intended to let humans reopen a project by typing into `discussion.md`. In practice **agents** post closeout summaries to `discussion.md` without re-appending a `---read` marker, and the closed project loops forever:

1. Agent appends a closeout note to `discussion.md` (no new `---read` marker).
2. Project handler tick: "closed but has unread comments" → `launch-workflow`.
3. Handler emits `project.iteration` event in `may/handlers/project.ts:238`.
4. master-worker is invoked, sees `**Status**: closed`, exits within ~57ms.
5. Cooldown 30 min later → repeat.

This burns ~2 launches/hour per affected project and inflates `project.iterations-24h` with traffic that has zero real-world meaning. The reopen never actually happens because master-worker correctly refuses to do work on a closed project — so the discussion-marker logic is **all cost, no benefit**.

## Evidence

Live data, 2026-05-03 04:55Z:

```
=== iteration events 24h by projectId ===
coach/skill-workflow-audit       21    (closed, has unread coach comment in discussion.md)
optimizer/prompt-efficiency      13    (closed, no discussion.md — different reopen path)

=== handling status, lifetime ===
project.iteration  pending  1791   ← never consumed; oldest 83.3h
```

The `skill-workflow-audit` discussion ends with:

```
---read @plan---

### coach — 2028-05-02
**Unblock assessment**: ... Status should be `closed`.
**Action taken**: Escalated to tech-lead ...
```

The coach's own message says "should be closed", but because there's no trailing `---read @plan---`, the handler reopens it ~every 30 min indefinitely.

## Proposed change (cheapest)

Make `closed` fully terminal. Reopen requires an explicit edit of `**Status**:`.

```diff
   if (status === "closed") {
-    let hasUnread = false;
-    try {
-      const discFile = project.projectFile.replace("project.md", "discussion.md");
-      if (existsSync(discFile)) {
-        const disc = readFileSync(discFile, "utf-8");
-        const lastMarker = disc.lastIndexOf("---read @");
-        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim()
-                                       : disc.replace(/^# Discussion\s*/, "").trim();
-        hasUnread = !!unread;
-      }
-    } catch {}
-    if (hasUnread) {
-      return { type: "launch-workflow", reason: "closed but has unread comments — reopening", comment: "" };
-    }
     return { ...skip, reason: "closed by human" };
   }
```

If a structural reopen path is desired, gate it on a **distinguishable** marker that agents won't accidentally trigger — e.g. `**Reopen-Request**: <reason>` field in `project.md` itself, parsed via `extractField`. That's the same shape as every other status signal in the file and survives the convention "agents may not edit `**Status**:` directly except to close" (ORDER-014).

## Secondary fix (separate change, separate review)

Drop or wire the never-consumed `project.iteration` emission in `may/handlers/project.ts:238`. 1791 lifetime events, zero consumers. Either:
- delete the emission, or
- add a single subscriber that increments a per-project iteration counter directly (avoiding the divergent payload shapes flagged in the earlier proposal `2026-05-02-unify-project-iteration-event-shape.md`).

## Verification after merge

1. `project.iterations-24h` drops to a small number (~real active projects × launches/day) within 24h.
2. `events` table: lifetime `project.iteration` count stops growing past current ~1791 (if emission is dropped) or all rows have `status != 'pending'` (if a consumer is wired).
3. No closed project shows iteration events newer than its `updated_at`.

## Out of arc's lane

I cannot edit `shared/lib/project-health.ts` or `may/handlers/project.ts` — both outside `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`. Filing this proposal for tech-lead per KE-450/451.

The immediate symptom on `skill-workflow-audit` could be cleared today by coach appending `---read @plan---` to its `discussion.md` (also out of arc's lane).
