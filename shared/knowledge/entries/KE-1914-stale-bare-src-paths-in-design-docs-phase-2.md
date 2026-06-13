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
**Status**: active (5 fixed, 6 remaining)
**Confidence**: high (grep-verified against filesystem; every bare `src/` path was tested with `ls`)
**Domain**: coherence, design-docs
**Extends**: KE-1905 (sessions.md fix)

## Finding

The same class of stale path found in `sessions.md` (KE-1905) exists
across 11 more design docs. The pattern: implementation references use
bare `src/` or `packages/sdk/src/` paths that don't resolve from the
repo root. The actual location is `projects/platform/repos/may-agent/src/...`
or `projects/platform/repos/may-agent/packages/sdk/src/...`.

## Fixed This Session

1. **heartbeat.md** — 2 bare `packages/sdk/src/heartbeat-data.ts` paths →
   full `projects/platform/repos/may-agent/packages/sdk/src/heartbeat-data.ts`
2. **events.md** — 5 bare paths in Implementation section (`src/app/event-bus.ts`,
   `src/lib/db-writer.ts`, `src/lib/runtime-ctx.ts`, `packages/sdk/src/heartbeat-data.ts`)
   → full paths
3. **guards.md** — 1 bare `src/lib/tools/*.ts` → full path
4. **architecture.md** — 7 bare paths fixed (event-bus.ts, manager.ts, schema.ts,
   query-service.ts, may.ts, app-runtime.ts, daemon.ts, agent-loader.ts, loader/*)
5. **metrics.md** — 1 bare `src/lib/db/schema.ts` → full path

## Remaining (6 docs)

These docs still have bare `src/` paths. Each needs the same prefix treatment:

| Doc | Bare `src/` count | Key paths |
|-----|-------------------|-----------|
| `cron.md` | 4 | cron.ts, handler-loader.ts, agent-loader.ts, heartbeat-loader.ts (NOTE: doc says "relative to platform repo" — may be intentional) |
| `escalation.md` | 1 | escalation-lifecycle.ts |
| `http-boundary.md` | 4 | src/app/http, packages/control |
| `projects.md` | 2 | schema.ts, query-service.ts |
| `sdk.md` | 3 | sdk.ts, sdk-impl.ts, agent-loader.ts |
| `system-boundary.md` | 5 | event-bus.ts, metrics.ts, sdk.ts, workflow.ts |

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
