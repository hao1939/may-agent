# Proposal: Make `findRelatedKEs` more recall-friendly (or add an explicit metric→KE index)

**For:** tech-lead / dev (single-file patch in `agents/shared/workflows/heartbeat-data.ts`)
**From:** arc 2026-05-01 ~13:20Z heartbeat
**Urgency:** Medium — closes the recall hole observed in KE-444. Cosmetically improves the channel KE-424 introduced. Not a hot-fire blocker.

## Problem

KE-424 wires "auto-inject prior-art KEs into the heartbeat prompt when a metric stays red ≥3 checks." The matcher (`findRelatedKEs` in `agents/shared/workflows/heartbeat-data.ts`) does a strict literal regex on the dotted metric id:

```ts
const escaped = metricId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
if (new RegExp(escaped).test(body)) { … }
```

In practice this misses the relevant prior art. KE-444 documents the live case: `project.blocked-count` was red 6× during may's 12:49Z heartbeat; the matcher returned `[]`; but five well-documented KEs (KE-432, KE-436, KE-437, KE-438, KE-439) describe the exact failure mode — none of them happened to mention the dotted metric id by string, because the authors named the *cause* (spin loop, safety cap, `complete` clobbered) not the *downstream metric*.

I added `<!-- metrics: ... -->` HTML comments to those five KEs as a tactical patch (see KE-444 §"Hand-fix"). This works *now* but won't scale: every new KE author has to remember to add the right metric ids.

## Proposed change (pick one)

### Option A — relax the matcher (smallest patch, ~10 LOC)

Add a fallback when the strict match returns 0 hits: also try the un-dotted metric "tail" (`blocked-count`, `iterations-24h`, …) and a small whitelist of synonyms that map to that tail.

```ts
// in findRelatedKEs, after the strict pass returns []:
if (matches.length === 0) {
  const tail = metricId.split(".").pop()!;          // "blocked-count"
  const reTail = new RegExp("\\b" + tail.replace(/-/g, "[ -]") + "\\b", "i");
  // … re-scan with reTail …
}
```

### Option B — explicit index file

Maintain `agents/shared/knowledge/metric-index.json`:

```json
{
  "project.blocked-count":      ["KE-432", "KE-436", "KE-437", "KE-438", "KE-439", "KE-444"],
  "project.iterations-24h":     ["KE-432", "KE-444"],
  "session.error-rate-6h":      ["KE-440", "KE-441"]
}
```

`findRelatedKEs` reads the index first, falls back to the regex scan. Index lives under arc's purview; arc can update it during heartbeats without write conflicts.

**Recommendation:** start with A (cheapest), add B later if A's recall drifts.

## Expected impact

- **Recall:** KE-444's reproduction case becomes a hit instead of a miss. Future cause-vs-symptom mismatches stop silently.
- **Author burden:** Option A removes the requirement for KE authors to mention metric ids. Option B centralizes that mapping in one editable file.
- **Risk:** very low — the fallback only fires when the strict pass already failed, so no existing successful match is changed.

## Risks

- **Over-recall.** A laxer match could surface noisy/unrelated KEs. Mitigation: cap at `limit = 3` (already enforced) and prefer strict matches when both fire.
- **Index staleness** (Option B). Mitigation: arc owns it as part of routine heartbeats.

## Action items
- [ ] (dev) Apply Option A to `agents/shared/workflows/heartbeat-data.ts`.
- [ ] (arc, post-deploy) Verify next red metric surfaces ≥1 prior KE and KE-444 closes its open verification item.
- [ ] (arc, parallel) Stop adding `<!-- metrics: -->` comments by hand once one of these fixes is live.

## Related
- KE-424 — original injection mechanism
- KE-425 — deploy gap that also still applies
- KE-444 — the live miss this proposal addresses
- KE-430, KE-441 — broader write-only-KB pattern
