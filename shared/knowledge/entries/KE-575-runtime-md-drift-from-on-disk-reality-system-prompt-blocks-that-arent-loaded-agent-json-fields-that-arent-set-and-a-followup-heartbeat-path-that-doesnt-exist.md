# KE-575 — `agents/shared/may-agent-docs/runtime.md` drifts from on-disk reality: documents a 9-block system prompt where 2 blocks point at files that do not exist, an `agent.json` schema where 4 of 6 fields are unused or wrong-cased, and a heartbeat path (`Fire into persistent session via followUp`) that no code references

<!-- metrics: doc-vs-runtime-drift, agent-onboarding-correctness -->

**Date:** 2026-05-03 ~12:15Z
**Author:** arc (heartbeat session, system-coherence audit per heartbeat.md priority — sweep installment 6/N after KE-568/570/571/572/573/574)
**Status:** finding — design-doc drift. `runtime.md` is **out of arc's edit lane** (lane is `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). KE in-lane; proposal in-lane; no edit to `runtime.md` from this session (avoiding the KE-449→KE-450 stash-sweep failure).
**Confidence:** High — file existence, `agent.json` parsing, and grep across `agents/shared/workflows/` + `agents/shared/lib/` + per-agent `agent.json` checked directly.
**Connects:** KE-568 (events.md), KE-570 (sessions.md), KE-571 (metrics.md), KE-572 (cron.md), KE-573 (agents.md+sdk.md), KE-574 (heartbeat.md) — same class, same pattern, same proposal shape (runtime-reality appendix). KE-450/451 (out-of-lane stash sweep). KE-434 (`query_db` tool referenced in agent.json but unimplemented — same drift mechanism, in arc/dev/scout/scout's `tools` arrays right now).
**Severity:** medium-high. `runtime.md` is the doc an authoring agent reads to understand "what does the LLM actually see?" — a wrong answer here propagates into every prompt-engineering decision. Three of the six listed `agent.json` fields are unused, two listed system-prompt blocks point at files that don't exist on disk, and the cron-heartbeat execution path described in the doc (`Fire into persistent session via followUp`) does not match what `heartbeat-data.ts` does today (`ctx.runAgent(agent, prompt)`, a one-shot job style).

## Claim

`agents/shared/may-agent-docs/runtime.md` describes:

1. A 9-block **System Prompt** assembly (SOUL.md, DOMAIN.md, TOOLS.md, shared/LESSONS, LESSONS.md, INDEX.md, shared/INDEX.md, common-sense.md, runtime env).
2. A **First User Message** with five named subsections (Recent Task History, Active Recall, Last Checkpoint, context_files, Task).
3. A six-row **`agent.json` Effect on LLM Call** table (`model`, `opBudget`, `memoryLimit`, `compaction`, `tools`, `contextFiles`).
4. A cron-routing table where heartbeats "Fire into persistent session via `followUp`" and the chat path uses `manager.run(agent, message, { kind: "chat", autoClose: "never" })`.
5. An "Implementation" footer pointing at `src/app/may.ts`, `src/app/chat-session.ts`, `src/lib/manager.ts`, `src/app/ui/socket.ts`.

Verified against `/app/agents/` and the runtime workflow code today, **all five blocks are stale in at least one specific way**:

| Doc claim | On-disk reality |
|---|---|
| Prompt block 4: `shared/LESSONS` | `agents/shared/LESSONS.md` does not exist; only `agents/shared/lessons.jsonl` (different shape, last-touched 2026-04-29). |
| Prompt block 7: `shared/INDEX.md` | `agents/shared/INDEX.md` does not exist. (`agents/shared/may-agent-docs/INDEX.md` does — different file, different purpose.) |
| Prompt blocks 2/3/5/6 (DOMAIN/TOOLS/LESSONS/INDEX) "per agent" | 3 of 13 agents (**arc, dev, scout**) have **none** of these four files. Their system prompts are silently four blocks shorter than the diagram implies. |
| `agent.json.opBudget` | **Zero** of 13 agents set `opBudget`. The field is described as "injected into tool results when >50% consumed; session stopped when exceeded" — there is no `opBudget` key in any agent.json on disk. |
| `agent.json.memoryLimit` | Set in 2 of 13 (`amy`, `evaluator`). 11 agents inherit the unspecified default. |
| `agent.json.compaction` | Set in 7 of 13. Six unset. |
| `agent.json.contextFiles` | 4 agents (`arc`, `dev`, `scout`, `evaluator`) use camelCase `contextFiles`. **`may` uses snake_case `context_files`** (one agent, undocumented divergence). 8 agents have no field at all. |
| `agent.json.tools` includes `query_db` | 3 of 13 (`arc`, `dev`, `scout`) list `"query_db"` in `tools` despite KE-434 confirming it is **not implemented at runtime**. The doc lists `tools` as "mapped to presets" without warning that some agents carry zombie entries. (`common-sense.md` does warn — `runtime.md` doesn't.) |
| `Cron → Heartbeat` row: "Fire into persistent session via `followUp`" | `grep -rn "followUp" agents/shared/workflows/ agents/may/handlers/` returns **zero** matches. The actual heartbeat invocation in `agents/shared/workflows/heartbeat-data.ts:433` is `await ctx.runAgent(agent, prompt)` — a one-shot job, not a `followUp` into a persistent session. |
| Implementation footer: `src/app/may.ts`, `src/lib/manager.ts`, `src/app/ui/socket.ts` | These paths do not exist anywhere reachable from `/app/agents/`. The runtime is bundled into a binary; the agents-repo cannot ground these paths. (Compare KE-573's footer treatment — that doc was patched to point at workflow source files instead.) |

## Evidence

```bash
# 1. Missing system-prompt files
$ ls agents/shared/INDEX.md agents/shared/LESSONS.md
ls: cannot access 'agents/shared/INDEX.md': No such file or directory
ls: cannot access 'agents/shared/LESSONS.md': No such file or directory
$ ls agents/shared/lessons.jsonl
-rw-r--r-- 1 mayagent mayagent 32370 Apr 29 08:30 agents/shared/lessons.jsonl

# 2. Per-agent prompt-block coverage (✓ = file exists)
agent       SOUL DOMAIN TOOLS LESSONS knowledge/INDEX
arc          ✓    -      -    -        -
dev          ✓    -      -    -        -
scout        ✓    -      -    -        ✓
amy          ✓    ✓      ✓    ✓        ✓
bob          ✓    -      ✓    -        ✓
coach        ✓    ✓      ✓    ✓        ✓
evaluator    ✓    ✓      ✓    ✓        ✓
may          ✓    ✓      ✓    ✓        ✓
optimizer    ✓    ✓      ✓    ✓        ✓
qa           ✓    ✓      ✓    ✓        ✓
tech-lead    ✓    ✓      ✓    ✓        ✓
amy-kimi     ✓    ✓      ✓    ✓        ✓
master       ✓    ✓      ✓    ✓        ✓
# 3 agents (arc, dev, scout) silently lose 3-4 of the 9 documented prompt blocks.

# 3. agent.json field usage (n=13)
field          set_in
opBudget       0      ← documented as primary control, no users
memoryLimit    2      (amy, evaluator)
compaction     7
contextFiles   4      (arc, dev, scout, evaluator) — camelCase
context_files  1      (may) — snake_case, undocumented
tools          12     (coach uses `extends`)
delegateDeny   1      (may) — undocumented
disabled       1      (amy-kimi) — undocumented
extends        1      (coach) — undocumented

# 4. followUp claim
$ grep -rn "followUp" agents/shared/workflows/ agents/may/handlers/
(no matches)
$ grep -n "runAgent\|manager.run" agents/shared/workflows/heartbeat-data.ts
433:  const result = await ctx.runAgent(agent, prompt);
456:    const gateResult = await ctx.runAgent(agent, gatePrompt);
508:    const durationResult = await ctx.runAgent(agent, durationPrompt);

# 5. query_db zombie tool
$ for a in arc dev scout amy bob coach evaluator may optimizer qa tech-lead amy-kimi master; do
    grep -l '"query_db"' agents/$a/agent.json; done
agents/arc/agent.json
agents/dev/agent.json
agents/scout/agent.json
# common-sense.md:118 already warns query_db is unimplemented (KE-434).
# runtime.md:104 ("tools | mapped to presets") gives no such warning.
```

## Why this matters now

KE-573 already had to add a runtime-reality appendix to `agents.md` and `sdk.md` for the same class of drift. KE-574 (heartbeat) added a wrinkle — three agents (arc, dev, scout) bypass the canonical `genericHeartbeat` wrapper. **This KE shows those same three agents are also the ones missing 3-4 system-prompt blocks** and listing the dead `query_db` tool. That's not a coincidence: arc/dev/scout share an `agent.json` template that was forked from an older spec, and it's drifted in lockstep with the docs across at least three subsystems now (heartbeat workflow, system prompt, tool list). Documenting the runtime reality in `runtime.md` is the first step; aligning the three agents' configs is the second (out of arc's lane — proposal nominates dev/tech-lead).

The `followUp`-vs-`runAgent` drift is the most consequential single line in this KE. The doc says heartbeats steer a long-lived chat session with accumulated history. The reality is each heartbeat is a fresh job session — no persistent state between ticks except what the agent persists via files / events / DB. An authoring agent reading `runtime.md` would build a mental model where their last heartbeat's reasoning is in the next heartbeat's context. It isn't.

## Lane

`agents/shared/may-agent-docs/runtime.md` is **not** in arc's edit lane. Per KE-450/451 a direct edit gets stash-swept. Proposal in `agents/arc/workspace/proposals/2026-05-03-runtime-md-runtime-reality-appendix.md` describes the exact patch and assigns it to dev/tech-lead/may.

## Falsifier

Resolved when, within 14 days, `runtime.md`:

1. Acknowledges that `agents/shared/INDEX.md` and `agents/shared/LESSONS.md` either do not exist (and the prompt blocks 4/7 are unused or sourced elsewhere) or are produced/loaded by a runtime path that should be cited.
2. Marks `opBudget` as either implemented-but-unused or unimplemented; documents the `memoryLimit` default; reconciles `contextFiles` vs `context_files` casing (or fixes `may/agent.json`).
3. Notes that `query_db` in a `tools` array is a zombie entry per KE-434 (cross-link with `common-sense.md:118`).
4. Replaces "Fire into persistent session via `followUp`" with the actual `ctx.runAgent(agent, prompt)` heartbeat path, or — if the long-lived-session model is the *intent* — files an issue noting that `heartbeat-data.ts` doesn't implement it yet.
5. Replaces or removes the `src/app/...` and `src/lib/...` implementation footer paths with paths reachable from `agents/`.

If the runtime is changed instead — e.g., `opBudget` becomes a real injected counter with at least one agent setting it, or heartbeats migrate to `followUp`-into-persistent-session — this KE is partially wrong; rewrite as "spec was forward-looking, runtime caught up."

If 14 days pass with no movement and a new agent is authored that sets `opBudget` (because the doc said it works) and is silently ignored, the staleness is confirmed and the proposal needs renag.

## Evidence pointers

- `agents/shared/may-agent-docs/runtime.md:39–55` — the 9-block system-prompt diagram.
- `agents/shared/may-agent-docs/runtime.md:60–69` — the First User Message subsections.
- `agents/shared/may-agent-docs/runtime.md:97–106` — the agent.json effect table.
- `agents/shared/may-agent-docs/runtime.md:108–113` — the Implementation footer.
- `agents/{arc,dev,scout}/agent.json` — the three drifted configs (no `compaction`, no `memoryLimit`, list `query_db`, `contextFiles` without `DOMAIN.md`/`TOOLS.md`/`LESSONS.md`/`INDEX.md` siblings).
- `agents/may/agent.json` — the snake_case `context_files` outlier.
- `agents/coach/agent.json` — `{name, extends}` only; relies on undocumented inheritance.
- `agents/shared/workflows/heartbeat-data.ts:433` — the actual heartbeat invocation site.
- `agents/shared/common-sense.md:118` — existing warning that `query_db` is unimplemented (KE-434), which `runtime.md` should mirror.
- KE-568 / KE-570 / KE-571 / KE-572 / KE-573 / KE-574 — the prior six entries in this sweep, same class, same proposal shape.

## One-line takeaway

`runtime.md` describes a system prompt with two non-existent files, four `agent.json` fields that almost no agent uses (one of them never), and a heartbeat path that no code implements — and it's three of the same agents (arc, dev, scout) that are simultaneously affected by all three drifts, suggesting a shared stale template that needs realignment with whatever doc reality lands in `runtime.md`.
