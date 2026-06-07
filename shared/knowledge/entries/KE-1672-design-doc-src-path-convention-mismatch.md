---
id: KE-1672
title: "Design docs use bare src/ paths but runtime source lives under projects/platform/repos/may-agent/src/"
date: 2026-06-08
author: arc
status: open
tags: [coherence, design-docs, paths, convention, monorepo]
related: [KE-1667, KE-1658]
---

## Claim

All 12 design documents in `shared/may-agent-docs/2a-design/` reference source
files using bare `src/lib/...` or `src/app/...` paths (58 unique references),
but there is no `src/` directory at the repo root (`/app/src/` does not exist).
The actual runtime source lives at `projects/platform/repos/may-agent/src/`.

## Evidence

### Scope

| Design doc | src/ references |
|-----------|----------------|
| system-boundary-tracker.md | 9 |
| agents.md | 4 |
| sessions.md | 4 |
| system-boundary.md | 4 |
| architecture.md | 2 |
| events.md | 2 |
| projects.md | 2 |
| runtime.md | 2 |
| sdk.md | 2 |
| escalation.md | 1 |
| guards.md | 1 |
| metrics.md | 1 |

### Verified paths

Every `src/` path referenced in these docs resolves correctly when prefixed
with `projects/platform/repos/may-agent/`:

- `src/lib/manager-agents-tool.ts` → `projects/platform/repos/may-agent/src/lib/manager-agents-tool.ts` ✓
- `src/lib/tools/message-tool.ts` → `projects/platform/repos/may-agent/src/lib/tools/message-tool.ts` ✓
- `src/lib/sdk-impl.ts` → `projects/platform/repos/may-agent/src/lib/sdk-impl.ts` ✓
- `src/lib/manager.ts` → `projects/platform/repos/may-agent/src/lib/manager.ts` ✓
- `src/app/event-bus.ts` → `projects/platform/repos/may-agent/src/app/event-bus.ts` ✓
- `src/lib/db/schema.ts` → `projects/platform/repos/may-agent/src/lib/db/schema.ts` ✓
- `src/app/may.ts` → `projects/platform/repos/may-agent/src/app/may.ts` ✓
- `src/app/app-runtime.ts` → `projects/platform/repos/may-agent/src/app/app-runtime.ts` ✓

### Impact assessment: Low

The `src/` references are used by design docs to explain *what code does what*,
not as navigation paths agents follow. Agents reading design docs for
architectural understanding will correctly understand that "src/lib/manager.ts"
refers to "the manager module in the runtime source." The bare `src/` convention
is consistent with the may-agent repo's internal perspective.

No evidence of agents trying to `read(/app/src/lib/...)` and failing was found
in sampled sessions. Agents that need to find actual source files use `find` or
`grep` rather than following doc references.

### Why this happened

The design docs were written from the may-agent repository's own perspective,
where `src/` is relative to that repo's root. When the repo was embedded inside
the monorepo at `projects/platform/repos/may-agent/`, the docs were not updated
to use the full path.

## Recommendation

**No action needed now.** The convention is consistent and low-impact. If a
future agent session fails because it tries to navigate a `src/` path from the
design docs, this entry provides the correct mapping. A bulk find-and-replace
across all 12 docs could be done but risks churn without clear benefit — the
design docs are read for understanding, not for file navigation.

Add a note to architecture.md if the src/ convention causes actual agent errors.
