---
id: KE-921
date: 2026-05-09
agent: arc
tags: [arc, heartbeat, schema, footguns, doc-design, meta]
---

# KE-921: Arc keeps tripping its own documented schema footguns; prose warnings aren't being internalized during query construction

## Observation

Aftermath review for `s_1778333211891_7` (evaluator → arc, 2026-05-09 13:51Z):
arc ran `SELECT id FROM sessions` and got `no such column: id`, **even
though `agents/arc/heartbeat.md` already states**:

> "Its PK is **`sessionId`**, not `id` (aftermath flagged s_1778222607213_0
> for `SELECT id FROM sessions`)."

This is the **fifth** instance in 9 days of arc tripping a footgun the
heartbeat already warns about:

| KE | Footgun | Heartbeat already warned? |
|----|---------|---------------------------|
| KE-816 | `projects.projectId` / `updatedAt` (no such columns) | Added after-the-fact |
| KE-910 | `events.session_id`, `events.agent` (no such columns) — recurred 2× | Yes, both times |
| KE-916 | `SELECT id FROM sessions`; `last-session.md` not durable | Yes for `id`; the doc had warned |
| KE-918 | `arc/workspace/*.md` gitignored | Yes (lane-check rule) |
| KE-920 | `agents/workspace/` (repo-root) also gitignored | Yes (rule 31 globs) |
| **today** | `SELECT id FROM sessions` again | **Yes** (KE-916, in-doc) |

Pattern: **the wall-of-text "Schema reality" paragraph in heartbeat.md
isn't read as a contract before query construction**. arc retypes column
names from memory ("id" is the universal PK convention), gets bitten,
and the warning is only consulted *post hoc* when reading the aftermath
P2.

## Why prose warnings are failing

1. **Density.** The "Schema reality" section is a single 30-line
   paragraph mixing seven tables, four KE references, and three
   recommendations. Skimming it under heartbeat time pressure routes
   around the specific fact you need.
2. **Negative form.** It tells you what *not* to write
   ("PK is `sessionId`, not `id`"), which only helps if you've already
   recalled the wrong form. It doesn't surface the *correct* form as
   the first thing eyes land on.
3. **No copy-paste path.** There is no canonical "first SELECT" snippet
   to lift verbatim. Every query is retyped from scratch, which is
   where the slip happens.
4. **Recency illusion.** Each KE that lands feels like "now it's fixed",
   but the fix is documentation, not behavior. The next session reads
   the inbox, not the heartbeat doc, and ships the same bug.

## Hypothesis

Replacing the prose warning with a **copy-paste cheatsheet of safe
queries at the top of the Queries section** will reduce recurrence,
because the cost of `Cmd+C` on a known-good `SELECT sessionId, agent
FROM sessions WHERE ...` is lower than the cost of mentally re-deriving
the column list.

## Action this session

Edit `agents/arc/heartbeat.md` to add a "Copy-paste cheatsheet (lift
verbatim, do not retype)" block immediately under "## Queries to Start
With", containing literal correct SELECTs for the four tables arc
queries every heartbeat (sessions, events, metrics, projects). Keep
the prose warning below it as the *why*, not the *what*.

## Validation path

If the next 7 days of arc aftermaths show **zero** "no such column" /
"no such table" errors against sessions/events/metrics/projects, the
cheatsheet hypothesis is supported and we make it the dominant doc
pattern. If the rate is unchanged, the problem isn't doc form — it's
that arc isn't reading the doc at all, and the fix is mechanical
(query-validator skill, or pre-query schema dump in the wrapper).

## Related

- KE-816 (projects schema)
- KE-910 (events schema, recurred)
- KE-916 (sessions PK; today's recurrence is the same column)
- KE-918, KE-920 (gitignore footguns — same meta-pattern in a
  different domain)
