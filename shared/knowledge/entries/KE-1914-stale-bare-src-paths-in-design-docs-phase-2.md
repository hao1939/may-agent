<ai_context>
Design docs in shared/may-agent-docs/2a-design/ use bare `src/` paths (e.g.
`src/app/event-bus.ts`) that don't resolve at the repo root. The actual paths
are `projects/platform/repos/may-agent/src/...`. KE-1905 fixed sessions.md;
this entry covers heartbeat.md, events.md, and guards.md (fixed), plus 8
remaining docs with the same issue.
Tags: coherence, design-docs, stale-paths, implementation-paths
Related: KE-1905, KE-1890
</ai_context>

# KE-1914: Stale Bare `src/` Paths in Design Docs — Phase 2

**Discovered**: 2026-06-15
**Status**: active (8 fixed this session + previous session, 1 remaining)
**Confidence**: high (grep-verified against filesystem; every bare `src/` path was tested with `ls`)
**Domain**: coherence, design-docs
**Extends**: KE-1905 (sessions.md fix)

## Finding

The same class of stale path found in `sessions.md` (KE-1905) exists
across 11 more design docs. The pattern: implementation references use
bare `src/` or `packages/sdk/src/` paths that don't resolve from the
repo root. The actual location is `projects/platform/repos/may-agent/src/...`
or `projects/platform/repos/may-agent/packages/sdk/src/...`.

## Fixed This Session (Phase 2 — first pass)

1. **heartbeat.md** — 2 bare `packages/sdk/src/heartbeat-data.ts` paths →
   full `projects/platform/repos/may-agent/packages/sdk/src/heartbeat-data.ts`
2. **events.md** — 5 bare paths in Implementation section (`src/app/event-bus.ts`,
   `src/lib/db-writer.ts`, `src/lib/runtime-ctx.ts`, `packages/sdk/src/heartbeat-data.ts`)
   → full paths
3. **guards.md** — 1 bare `src/lib/tools/*.ts` → full path
4. **architecture.md** — 7 bare paths fixed (event-bus.ts, manager.ts, schema.ts,
   query-service.ts, may.ts, app-runtime.ts, daemon.ts, agent-loader.ts, loader/*)
5. **metrics.md** — 1 bare `src/lib/db/schema.ts` → full path

## Fixed Phase 2 — second pass (current session)

6. **projects.md** — 2 bare paths fixed (`src/lib/db/schema.ts`, `src/lib/query-service.ts`)
7. **escalation.md** — 2 bare paths fixed (`src/app/daemon-events.ts`, `src/lib/escalation-lifecycle.ts`)
8. **sdk.md** — 4 bare paths fixed (`src/lib/sdk.ts`, `packages/sdk/src/index.ts`, `src/lib/sdk-impl.ts`, `src/app/agent-loader.ts`)
9. **system-boundary.md** — 19 bare paths fixed (full code mapping table + loader/* reference)
10. **http-boundary.md** — 8 bare paths fixed (ownership table, API inventory, layout, migration plan)

## Remaining (1 doc)

| Doc | Bare `src/` count | Notes |
|-----|-------------------|-------|
| `cron.md` | 4 | Doc explicitly says "All paths below are relative to the platform repo" — intentional shorthand, skip |

(`system-boundary-tracker.md` also has bare paths but in a checklist context
where the bare form may be intentional shorthand; low priority.)

(`sessions.md` still has 2 bare `src/` mentions in prose that describe a
"requires a `src/` change" — these are category references, not file paths.)

## Why This Matters

Agents reading design docs to understand the system will attempt to `read()`
or `ls` the referenced paths and get "file not found." This creates the same
footgun documented in KE-1905: wasted tool calls and potential hallucinated
corrections.

## Recommended Fix

Prefix each bare `src/` implementation path with
`projects/platform/repos/may-agent/`. Can be done mechanically in one
session per doc.
