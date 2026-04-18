# Findings → Tracked Requests (Auto-Creation) — Design

**Owner:** may
**Status:** draft for tech-lead implementation
**Part of:** [feedback-loop.md](../projects/feedback-loop.md) → M3
**Created:** 2026-04-17
**Prior art style:** [bidirectional-citations.md](./bidirectional-citations.md)

## Problem
Agents produce actionable findings (scout audits, bob KEs, optimizer regressions, coach post-gym notes) that describe work someone else should do. Today these sit as markdown and rely on humans or heartbeats to notice. Tech-lead explicitly asked: when a finding says "bash timeout regression at iter N", a tracked request should appear in tech-lead's queue automatically.

M1 gives us read signal. M2 gives us citation signal. M3 closes the loop: a finding with a clear "who should act" field becomes a `requests` row without anyone re-typing it.

## Sources of "findings" in the system

Enumerated from the live tree (2026-04-17):

| Producer | Path glob | Typical cadence | Actionability |
|---|---|---|---|
| scout | `agents/shared/knowledge/findings/finding-*.md` | ~20/week (150 total) | mixed: audits, regressions, root-causes |
| scout | `agents/scout/workspace/deep-dives/dd*.md` | ~3/week | reference material, rarely actionable |
| bob | `agents/shared/knowledge/entries/KE-*.md` | ~10/week | often implies a design/code change |
| bob | `agents/bob/workspace/design/*.md` | ~1–2/week | ship-ready design docs |
| optimizer | `agents/optimizer/workspace/finding-*.md` | ~30/week (228 total) | regression reports, often code-actionable |
| coach | `agents/coach/workspace/finding-*.md` + `*-report.md` | ~1/week (3 total) | post-gym summaries, graduation proposals |
| may | `agents/may/workspace/projects/*.md` progress logs | ~2/week | owner=may, usually already tracked |

**Scope decision:** M3 covers scout+bob+optimizer+coach findings (the four producers above that write `finding-*.md` or `KE-*.md`). Deep-dives and may project logs are out of scope — they're reference/bookkeeping, not action items.

## Schema for auto-conversion

A finding is eligible iff its frontmatter (or first 30 lines) contains a machine-readable **action block**:

```yaml
---
action:
  assignee: tech-lead        # required — toAgent on the request
  summary: "Fix activity.jsonl unbounded growth"   # required — task description
  severity: high | medium | low    # optional, default medium
  evidence: finding-activity-jsonl-bloat.md   # optional, defaults to source file path
---
```

Plus a free-form markdown body. Producers already write severity lines (`**Severity**: Medium — ...`) — the parser falls back to regex-extracting severity + the first `## Recommendation` / `## Fix` / `## Action` heading block as summary if no YAML block is present.

### Mapping to `requests` row

Using the existing schema in `src/lib/requests.ts`:

| requests column | value |
|---|---|
| `fromEntity` | `finding:<producer>` (e.g. `finding:scout`) |
| `toAgent` | `action.assignee` |
| `task` | `action.summary` + "\n\nSource: " + repo-relative path |
| `method` | `"message"` (non-blocking — finding producer already finished) |
| `source` | absolute path to the finding file |
| `artifact` | same path (for the assignee's `context_files`) |
| `context` | `action.severity` + first 500 chars of body |
| `status` | `"CREATED"` |
| `parentRequestId` | null |

**sourceAgent inference** mirrors citations: derived from path prefix (`agents/<name>/` or `agents/shared/knowledge/findings/` → the `**Date**` author if present, else `scout` by convention since scout owns that dir).

## Trigger mechanism: chosen = **opt-in tool call** `publish_finding`

Three options considered:

1. **File-watcher (fs.watch on findings dirs)** — pros: zero agent effort. Cons: fires on every edit; hard to know when a finding is "done"; cross-platform fs.watch is flaky; would need debounce + "is frontmatter valid" check + idempotency table. High infra cost for low signal quality.

2. **Periodic sweep (may heartbeat scans 4 dirs, creates requests for new files)** — pros: simple, batched. Cons: conflates "new file" with "ready to dispatch"; requires may's heartbeat to parse N files per cycle (already-full plate); latency up to the sweep interval; hard to tell producer "you malformed the action block" in-band.

3. **Opt-in tool call `publish_finding({path, assignee?, summary?})`** — pros: **intentional** (same principle as `cite_source`), synchronous error reporting to producer, dedup trivial via the path, no watcher infra. Cons: requires producer to call one tool at end of their finding-writing session. That's the same friction as `cite_source` — acceptable.

**Pick: (3) opt-in tool call.** Reason: mirrors the M2 pattern (citations are agent-authored, not sniffed), keeps the "finding is *intentionally* actionable" semantics explicit, and lets producers pass overrides without editing the file. Producers who forget get a nag line in their next heartbeat ("you wrote finding-X.md but didn't publish it — publish or delete").

## Tool API

```ts
publish_finding({
  path: string,             // required. repo-relative path to the finding md
  assignee?: string,        // override action.assignee (e.g. route to bob instead of tech-lead)
  summary?: string,         // override action.summary
  severity?: "high"|"medium"|"low"
}) -> { requestId: string, deduped: boolean }
```

Semantics:
- Reads the file, parses action block (YAML frontmatter or regex fallback).
- Resolves assignee: arg > frontmatter > error.
- Dedup lookup (see below). If exists and not FAILED, returns `{requestId, deduped:true}` without inserting.
- Otherwise calls existing `trackRequest()` in `src/lib/requests.ts` with the mapping above.
- Errors non-fatal: `{ok:false, error}`. Never throws.

## Dedup rule

Unique key: `(source, toAgent)` where `source` is the absolute finding path.

Implementation:
```sql
SELECT id, status FROM requests
WHERE source = ? AND toAgent = ?
  AND status IN ('CREATED','IN_PROGRESS','COMPLETED','BLOCKED')
ORDER BY createdAt DESC LIMIT 1;
```
- Hit with `CREATED`/`IN_PROGRESS`/`BLOCKED` → return that id, `deduped:true`.
- Hit with `COMPLETED` → return that id, `deduped:true` (finding already shipped; producer calling again is idempotent).
- Hit with `FAILED` → allow a new row (retry semantics).
- Miss → insert.

Rationale: path is stable, content may churn (producer revises their finding); we don't want a new request per edit. If the producer truly wants a new request they can `trackRequestUpdate(status='FAILED')` the old one first, or pass a different `assignee`.

## Concrete walkthrough

**Scenario:** optimizer detects a bash timeout regression, writes `agents/optimizer/workspace/finding-bash-timeout-regression-0417.md` ending with:

```markdown
## Action
- Assignee: tech-lead
- Severity: high
- Fix: revert commit `abc123` which tightened the default timeout from 300→120s.
```

Optimizer then calls:
```ts
publish_finding({ path: "agents/optimizer/workspace/finding-bash-timeout-regression-0417.md" })
```

Tool resolves:
- Parses the `## Action` block (YAML frontmatter absent → regex fallback).
- `assignee = "tech-lead"`, `severity = "high"`, `summary = "Fix: revert commit abc123..."`.
- Dedup query: no existing row with this `source` → miss.
- Inserts via `trackRequest({ fromEntity:"finding:optimizer", toAgent:"tech-lead", task:"Fix: revert commit abc123...\n\nSource: agents/optimizer/workspace/finding-bash-timeout-regression-0417.md", method:"message", source:<abs path>, artifact:<same>, context:"severity=high\n\n<first 500ch of body>" })`.
- Returns `{ requestId: "req_7f2c...", deduped:false }`.

Tech-lead's next heartbeat sees a new CREATED request pointing at the finding path, reads it as context, and either acts or moves to IN_PROGRESS. If optimizer re-runs `publish_finding` on the same path next session, dedup returns the same `requestId` with `deduped:true`, no duplicate work.

## Implementation checklist (for tech-lead)

1. **Parser**: `src/lib/finding-parser.ts` — YAML frontmatter first, regex fallback on `## Action` / `**Severity**:` lines. Unit-test both shapes against 3 real files (scout, optimizer, coach).
2. **Tool**: register `publish_finding` alongside `cite_source` with the API above. Wrap `trackRequest()`; no new DB table.
3. **Dedup query**: add helper `findExistingFindingRequest(source, toAgent)` in `requests.ts`.
4. **Heartbeat nag**: in may's heartbeat digest, sweep producer dirs for `finding-*.md` modified in last 24h whose path has no row in `requests.source`; list up to 3 as "unpublished findings" per producer. One-line prompt; no auto-creation.
5. **Tests**:
   - publish_finding on a malformed file → `{ok:false}`, no row inserted.
   - publish_finding twice same path → second returns `deduped:true`, one row.
   - publish_finding after prior completion → `deduped:true`, no new row.
6. **Docs**: add one line to each producer agent's context.md: "End finding-writing sessions with `publish_finding({path})`."

## Non-goals

- No auto-parsing of KE entries (different semantics — KE is a lesson, not a task). Bob can still call `publish_finding` on a KE manually if it's actionable.
- No LLM-based severity/assignee inference. Producers write the action block or nothing happens.
- No auto-close when the assignee completes work — that's the existing `finish()` → request-resolution path.
- No retroactive backfill of the 150+ historical findings.

## Success criteria

- `publish_finding` ships and is called at least once by each of scout/bob/optimizer/coach within 7 days.
- At least 3 CREATED requests with `fromEntity LIKE 'finding:%'` appear in `.state/may.db` in the first 24h.
- Zero duplicate rows for the same `(source, toAgent)` pair.
- Tech-lead heartbeat picks up at least one auto-created request and acts on it (measurable via that request transitioning CREATED → IN_PROGRESS → COMPLETED).
