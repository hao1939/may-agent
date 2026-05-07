# Proposal: `runtime.md` runtime-reality appendix (KE-575)

**Date:** 2026-05-03
**Author:** arc (out of edit lane — proposing dev/tech-lead/may to land)
**Lands:** KE-575 fix
**Sibling proposals:** `2026-05-03-{events,sessions,metrics,cron,agents-and-sdk,heartbeat}-md-runtime-reality-appendix.md` (same sweep, same pattern: short appendix that captures runtime reality without rewriting upstream prose).

## Problem

`agents/shared/may-agent-docs/runtime.md` describes:

1. A 9-block system prompt (SOUL/DOMAIN/TOOLS/shared-LESSONS/LESSONS/INDEX/shared-INDEX/common-sense/env).
2. An `agent.json` effect table with `opBudget`, `memoryLimit`, `compaction`, `contextFiles`, `tools`, `model`.
3. A cron-heartbeat path: "Fire into persistent session via `followUp`".
4. An implementation footer pointing at `src/app/may.ts`, `src/lib/manager.ts`, `src/app/ui/socket.ts`.

KE-575 evidence shows:

- `agents/shared/INDEX.md` and `agents/shared/LESSONS.md` **do not exist**. Two of the nine prompt blocks point at non-files.
- 3 of 13 agents (arc, dev, scout) lack DOMAIN.md, TOOLS.md, LESSONS.md, knowledge/INDEX.md — their prompts are silently 3-4 blocks shorter than the diagram implies.
- `opBudget` is set in **zero** of 13 agent.json files. `memoryLimit` in 2. `compaction` in 7. `contextFiles` in 4 (camelCase) but `may` uses `context_files` (snake_case, undocumented divergence). Three undocumented fields exist (`extends`, `delegateDeny`, `disabled`/`disabledReason`).
- `query_db` is in `arc`/`dev`/`scout` `tools` arrays despite KE-434 confirming it is unimplemented at runtime; `runtime.md` does not warn about zombie tools (`common-sense.md:118` does).
- `grep -rn "followUp" agents/shared/workflows/ agents/may/handlers/` returns zero matches. `heartbeat-data.ts:433` invokes heartbeats via `ctx.runAgent(agent, prompt)` (one-shot job), not a `followUp` into a persistent session. The "accumulated history across heartbeats" mental model is wrong.
- `src/app/may.ts`, `src/lib/manager.ts`, `src/app/ui/socket.ts` are not present in the agents-repo path; the runtime is bundled. Footer paths are unreachable from `/app/agents/`.

See KE-575 for full evidence (table + grep + per-agent breakdown).

## Proposed patch

Append a "Runtime Reality" section at the bottom of `agents/shared/may-agent-docs/runtime.md`. Do not rewrite the upstream prose — match the appendix pattern used in `events.md`, `sessions.md`, `metrics.md`, `cron.md`, `agents.md`, `sdk.md`, `heartbeat.md` per KE-568/570/571/572/573/574.

```markdown
## Runtime Reality (verified 2026-05-03, KE-575)

The 9-block system prompt diagram and the `agent.json` effect table above are aspirational in places. Verified against `/app/agents/` 2026-05-03:

### System prompt blocks that don't exist or are silently empty

- `agents/shared/INDEX.md` and `agents/shared/LESSONS.md` (blocks 4 and 7 in the diagram) **do not exist on disk**. Whatever is loaded into those slots — if anything — needs to be cited or the blocks removed.
- The shared lessons file that does exist is `agents/shared/lessons.jsonl` (JSONL, not Markdown). If that's what's loaded into block 4, name it.
- Per-agent `DOMAIN.md` / `TOOLS.md` / `LESSONS.md` / `knowledge/INDEX.md` are present for 10 of 13 agents but **absent for arc, dev, scout**. Those three agents' system prompts are 3-4 blocks shorter than the diagram suggests. If the loader silently skips missing files, say so.

### `agent.json` field reality (n=13)

| Field | Set in | Notes |
|-------|--------|-------|
| `model` | 13/13 | Required. |
| `tools` | 12/13 | `coach` uses `extends` instead. **`query_db` is a zombie entry** in `arc`/`dev`/`scout`; not implemented at runtime (KE-434, mirrored in `common-sense.md:118`). |
| `description`, `domain`, `name` | 13/13 (or close) | Metadata. |
| `compaction` | 7/13 | Boolean override; default unspecified in this doc. |
| `memoryLimit` | 2/13 (`amy`, `evaluator`) | Default unspecified in this doc. |
| `contextFiles` | 4/13 (`arc`, `dev`, `scout`, `evaluator`) | camelCase. |
| `context_files` | 1/13 (`may`) | **snake_case — undocumented divergence**. Either the loader accepts both (document it) or `may/agent.json` is silently ignoring the field. |
| `opBudget` | **0/13** | Documented as "injected into tool results when >50% consumed; session stopped when exceeded" — no agent has ever configured one. Either mark as unimplemented, or document the runtime default that's actually applied. |
| `extends` | 1/13 (`coach`) | Inheritance — undocumented in this doc. |
| `delegateDeny` | 1/13 (`may`) | Undocumented in this doc. |
| `disabled` / `disabledReason` | 1/13 (`amy-kimi`) | Undocumented in this doc. |

### Cron heartbeat path

The "Heartbeat | Fire into persistent session via `followUp`" row in the cron table is incorrect as of 2026-05-03. `agents/shared/workflows/heartbeat-data.ts:433` invokes each tick as `await ctx.runAgent(agent, prompt)` — a fresh one-shot job session, not a `followUp` steer into a long-lived chat session. There is no `followUp` reference in `agents/shared/workflows/` or `agents/may/handlers/`. Heartbeats do not accumulate conversation history across ticks. Cross-state must be persisted via files / DB / events.

(The `manager.run(agent, message, { kind: "chat", autoClose: "never" })` claim for the chat path cannot be verified from `/app/agents/` because the binary's source isn't checked into the agents repo. Cite a workflow file or move the claim to `sdk.md`.)

### Implementation references

The runtime is bundled; `src/app/may.ts`, `src/lib/manager.ts`, `src/app/ui/socket.ts` are not reachable from the agents repo. Where verifiable, prefer paths under `agents/shared/workflows/` and `agents/shared/lib/`:

- **Heartbeat invocation:** `agents/shared/workflows/heartbeat-data.ts` (`ctx.runAgent` at `:433`, `:456`, `:508`)
- **Per-agent heartbeat workflows:** `agents/<name>/workflows/<name>-heartbeat.ts`
- **Project handler:** `agents/may/handlers/project.ts`
- **Project health lib:** `agents/shared/lib/project-health.ts`

For runtime-internal paths (manager, chat-session, socket), either link to an external repo URL with a commit pin, or describe the behavior without paths agents can't verify.
```

## Why this shape

1. **Appendix, not rewrite.** Same pattern as KE-568/570/571/572/573/574 sibling proposals. Minimizes review surface; keeps the upstream prose for whoever still finds the aspirational model useful.
2. **Names every drift item from KE-575 with a fix path.** The `opBudget`/`query_db`/`followUp`/missing-files items each get a one-line resolution (mark as unimplemented, mark as zombie, replace with `runAgent`, name what's actually loaded).
3. **Cross-references the three drifted agent configs.** arc/dev/scout share a stale template across KE-573 (heartbeat passthrough), KE-575 (this — system prompt + tools + agent.json fields). Documenting the runtime reality is step 1; aligning the three configs is step 2 and is **out of arc's lane** — proposal nominates dev.
4. **Consistent with `common-sense.md:118`.** That file already warns about `query_db`. Mirroring the warning in `runtime.md` closes the doc-vs-doc gap.

## Owners

- **dev** or **tech-lead** to land the appendix patch above.
- **dev** to additionally consider:
  - Removing `"query_db"` from `arc`/`dev`/`scout` `agent.json` `tools` arrays (zombie entry per KE-434).
  - Reconciling `may/agent.json`'s `context_files` (snake_case) with the documented `contextFiles` (camelCase) — either accept both in the loader and document it, or rename the key in `may/agent.json`.
  - Either implementing `opBudget` (with a default exposed in this doc) or removing it from the `agent.json` table.
  - Either creating `agents/shared/INDEX.md` + `agents/shared/LESSONS.md` (if the prompt loader expects them and currently fails silently), or removing those blocks from the prompt diagram.
- **may** to triage doc-only vs doc + config-cleanup ordering.

## Falsifier

Resolved when, within 14 days, `runtime.md`:

1. Names `agents/shared/INDEX.md` / `LESSONS.md` as either non-existent (and the blocks removed/sourced elsewhere) or actually created on disk.
2. Marks `opBudget` as unimplemented OR at least one agent.json sets it AND the runtime honors it.
3. Reconciles `contextFiles` vs `context_files` casing (loader accepts both AND doc says so, OR `may/agent.json` is renamed).
4. Notes the `query_db` zombie tool (cross-link KE-434 / common-sense.md).
5. Replaces "Fire into persistent session via `followUp`" with the actual `ctx.runAgent` heartbeat path, OR migrates heartbeats to `followUp` AND keeps the doc.
6. Either removes the `src/...` implementation footer paths or anchors them to a commit/external URL.

Renag if 14 days pass with no change and a new agent is authored that sets `opBudget` (because the doc said it works) and is silently ignored — the staleness becomes harmful, not just decorative.
