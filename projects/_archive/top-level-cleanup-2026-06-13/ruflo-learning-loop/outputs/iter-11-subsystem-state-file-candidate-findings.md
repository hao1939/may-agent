# Iter-11 — Ruflo idea #3 candidate hunt: periodic snapshot rows in `events`

**Iteration:** 11
**Owner:** dev/may (executor); arc judges go/no-go.
**Idea under test (from iter-10 §4):** Ruflo pattern #3 — *subsystems own their own state file; the shared event stream is for transitions, not heartbeats.*
**Falsifiable claim from iter-10:** there is at least **one** event_type in may.db's top-7 plumbing list whose payload is a periodic status snapshot rather than a state transition, and whose removal from `events` (in favour of a file or a dedicated table) would not break any reader. **If zero candidates → idea rejected for may-agent.**
**Live DB:** `/app/.state/may.db` snapshot 2026-05-09 ~02:55Z.

## 1. Top-7 plumbing event_types (24h) — re-confirmed

| event_type            | 24h count |
|-----------------------|----------:|
| handler.started       | 1840      |
| handler.completed     | 1814      |
| session.start         | 1108      |
| session.end           | 1103      |
| message.created       |  675      |
| session.completed     |  478      |
| context.read          |  155      |

(Query: `SELECT event_type, COUNT(*) FROM events WHERE timestamp >= (strftime('%s','now')-86400)*1000 GROUP BY event_type ORDER BY 2 DESC LIMIT 7`.)

## 2. Per-row test: snapshot vs. transition + reader audit

For each candidate the test is two questions:

- **Q1 — snapshot or transition?** Does the payload encode a *state-as-of-now* picture, or a *something happened* delta?
- **Q2 — readers?** `grep -rln "'<event_type>'" --include='*.ts' --include='*.mjs' --include='*.js' --include='*.sql' agents/ src/` (excluding `node_modules/` and `.state/`).

| event_type        | Q1: payload shape           | Q2: reader files (non-emitters) | Verdict |
|-------------------|------------------------------|-----------------------------------|---------|
| handler.started   | transition (one per invoke) | conformance-report.ts (presence check) | transition — keep |
| handler.completed | transition (status, ms)     | conformance-report.ts, heartbeat-data.ts | transition — keep |
| session.start     | transition                  | 0 readers in src; only test/gym scenarios | transition — keep |
| session.end       | transition                  | escalation.ts, metrics-snapshot.ts | transition — keep |
| message.created   | transition (msg row create) | 0 production readers (only knowledge entries / proposals reference the type by name) | transition — keep |
| session.completed | transition (final status)   | session-eval.ts, session-aftermath-scan.ts, closed-loop-steward.ts | transition — keep |
| **context.read**  | **snapshot** — payload is `{agent, sections:{metrics:bool, projects:bool, inbox:bool, alerts:bool}}`, emitted every heartbeat at a fixed point in `heartbeat-data.ts:501`. Sample row (most recent): `{"agent":"evaluator","sections":{"metrics":true,"projects":true,"inbox":true,"alerts":true}}`. It is not a state change; it is a confirmation that the heartbeat workflow reached the read stage. | **Exactly one production reader: `agents/shared/scripts/conformance-report.ts` (lines 74, 103, 130, 208, 211).** That reader uses only the *presence* of the event per session (`types.has("context.read")`), never its payload. | **CANDIDATE** |

Total 24h volume of `context.read`: 155 rows; lifetime: 197 rows. (Query confirms emission only at the heartbeat-data point; no other emit site found in `agents/**/*.ts`.)

## 3. The single candidate, in Ruflo terms

`context.read` matches Ruflo pattern #3 cleanly:

- It is a **periodic heartbeat dump** by one subsystem (the heartbeat workflow).
- Its consumer (`conformance-report.ts`) is exactly the kind of "one inspector script that reads what subsystems publish" Ruflo describes.
- The inspector does not need the row in the shared `events` table to do its job — it needs to know "did the heartbeat workflow reach the read stage for session X?" That signal is already in `handler.started` / `handler.completed` for the heartbeat handler, plus the `sections` snapshot could move to a per-agent state file (e.g. `.state/heartbeat/<agent>.json`) which the inspector reads directly.

## 4. What "removal would not break readers" actually requires

One file edit to `agents/shared/scripts/conformance-report.ts`:

- L74: drop `'context.read'` from the `IN (...)` list.
- L103, 130, 208, 209, 211: replace the "session has context.read event" presence check with "heartbeat-data handler reached the read step" — derivable from `handler.started` where `handler='heartbeat'` for that session_id, **or** from the proposed per-agent file `.state/heartbeat/<agent>.json` (whichever is cheaper).

No other `agents/**/*.ts` file references the string `context.read` outside the emitter and the conformance-report (verified by `grep -rln "context.read"` minus emitter).

## 5. Numeric exit criteria from iter-10 §4

- **(a) event_type:** `context.read`.
- **(b) 24h row count:** 155 (1.9 % of total 24h events; 2.2 % of plumbing).
- **(c) reader grep:** 1 file (`agents/shared/scripts/conformance-report.ts`), 5 line hits, all presence checks; 0 payload consumers.

Idea-rejection branch is **not** taken.

## 6. Go/no-go recommendation (3 bullets)

- **Go small.** The candidate is real, single-file to migrate, and zero production code consumes the payload — exactly the "smallest reversible Ruflo idea" the project charter asks for.
- **Do not generalise.** None of the other six top-7 event_types met both Q1 and Q2; the pattern applies to `context.read` and stops there for now. Resist the temptation to re-evaluate `handler.started/completed` as "snapshots" — they are per-invoke transitions and have multiple consumers.
- **Reversibility plan if iter-12 picks Go.** A single PR that (i) stops the emit at `heartbeat-data.ts:501`, (ii) writes `.state/heartbeat/<agent>.json` with `{ts, sections}` instead, (iii) updates `conformance-report.ts` to read either `handler.started` (heartbeat handler) or that file. Backout = revert one PR; the 155/day rows are a rounding error in the events table either way.

## 7. What this iteration intentionally does not do

- Does not edit `heartbeat-data.ts` or `conformance-report.ts`. Iter-11 is a hunt, not a migration.
- Does not propose new event_types (would invert the Ruflo lesson).
- Does not re-open KE-902 / dispatch_waiting / v2-spec-coverage-buildout.
- Does not produce a "support" file. Iter-10 §5 forbids a second file; this is the single findings file.
- Does not edit STATUS.md, NEXT.md, project.md, or the iter-6 watch log.

## 8. Heartbeat note

No watch loop. The next legitimate signal is iter-12: arc reads §6 and writes a one-paragraph `go` / `defer` / `reject` decision.
