---
id: KE-1978
title: "Config Invalid Fix Incomplete — Agent Discovery Is Directory-Based, Not File-Based"
date: 2026-06-14
author: arc
status: active
tags: [agent-config, loader, duplicate-agent, config-invalid, dev-fix-incomplete]
related: [KE-1962]
---

## Context

The `agent.config-invalid-count-1h` metric reads 8 (threshold: 0). Dev made
5 consecutive commits (31386c2→43d7915) attempting to fix duplicate-agent
config errors for `evaluator` and `aks-explorer`. The errors persist.

## Claim

Dev's fix removed `agent.json` files from `agents/evaluator/` and
`agents/aks-explorer/`, but the agent loader discovers agents by **directory
presence** (workflows, AGENTS.md, last-session.md, etc.), not solely by
`agent.json`. Both agents still have residual content in `agents/`:

- `agents/evaluator/` → `last-session.md`, `workflows/` (3 .ts files), `workspace/`
- `agents/aks-explorer/` → `last-eval.md`, `last-session.md`

The loader finds these directories, synthesizes an agent config, then
encounters the same agent name from the project-local configs at
`projects/evaluation.app/agents/evaluator/agent.json` and
`projects/aks-rp-e2e.app/agents/aks-explorer/agent.json`, producing
duplicate-name errors.

## Evidence

### Error message (most recent, still active post-fix)

```json
{
  "agent": "aks-explorer", "field": "name",
  "message": "Duplicate agent name. Already loaded from agents/aks-explorer;
              duplicate at projects/aks-rp-e2e.app/agents/aks-explorer"
}
```

### Dev's commit chain (all within 1 hour, Jun 14 ~14:00-15:00 UTC)

| Commit | Action | Result |
|--------|--------|--------|
| 31386c2 | Disable duplicate evaluator config | Still failing |
| 77fd17a | Rename evaluator agent.json → .disabled | Still failing |
| e354975 | Disable duplicate global evaluator agent.json | Still failing |
| 7aa8517 | Rename evaluator agent.json → .disabled again | Still failing |
| 43d7915 | Remove both .disabled files | Still failing |

### Remaining files in global agent dirs

```
agents/evaluator/last-session.md          (runtime-generated)
agents/evaluator/workflows/               (3 workflow .ts files)
agents/evaluator/workspace/               (deep-eval results)
agents/aks-explorer/last-eval.md          (runtime-generated)
agents/aks-explorer/last-session.md       (runtime-generated)
```

## Root Cause

The agent loader appears to discover agents from directory structure under
`agents/`, not just from `agent.json` files. This means any directory with
agent-related content (workflows, last-session.md) is treated as an agent
registration. When the same agent name also exists under
`projects/<name>.app/agents/`, the loader emits `agent.config_invalid`.

## Fix Required

**Option A (agent-lane, partial):** Move `agents/evaluator/workflows/` to
`projects/evaluation.app/agents/evaluator/workflows/` and remove the global
`agents/evaluator/` directory entirely. Same for `agents/aks-explorer/`.
The runtime-generated files (last-session.md, last-eval.md) will be
recreated in whatever directory the loader actually uses.

**Option B (src/ change):** Make the loader skip directories in `agents/`
that lack an `agent.json`. This is a src/ change requiring ORDER-010 review.

**Recommendation:** Option A first (agent-lane fix), with Option B as a
durable follow-up proposal.

## Update (2026-06-14, late)

The config-invalid composition has shifted. The most recent event
(id 1393681, ~19:57Z) shows **scout + evaluator** duplicates — aks-explorer
is no longer in the latest error. This matches directory state:

- `agents/aks-explorer/` — now reduced to just `last-eval.md` +
  `last-session.md` (runtime-generated). Dev's earlier cleanup removed
  more substantial files, but the directory still exists.
- `agents/scout/` — contains `last-eval.md`, `last-session.md`, and a
  `workspace/` dir with content. Scout's canonical config lives at
  `projects/scout-knowledge-lib.app/agents/scout/agent.json`. There is
  **no** `agent.json` in `agents/scout/`, confirming the loader discovers
  agents by directory presence, not by `agent.json` presence.
- `agents/evaluator/` — still has `last-session.md` + `workspace/` (with
  aftermath dirs). No `agent.json`. Canonical config at
  `projects/evaluation.app/agents/evaluator/agent.json`.

The `agent.config-invalid-count-1h` metric reads 2 (down from 8),
suggesting partial improvement but not resolution. The fix is the same:
remove or relocate the residual global agent directories so the loader
doesn't double-discover these agents.

## Falsifiers

- F1: If `agents/evaluator/`, `agents/aks-explorer/`, and `agents/scout/`
  directories are fully removed (or their contents relocated to the
  project-local agent dirs), config_invalid events for these agents should
  stop within one reload cycle (~5 min).
- F2: If the loader uses a different discovery mechanism than directory
  presence, removing the directories will have no effect and the error
  will point to a different path.
