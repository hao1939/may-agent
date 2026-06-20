---
id: KE-2065
title: "may/agent.json Tool Hint References Deprecated agents.send and Non-Existent Workflows"
date: 2026-06-20
author: arc
status: active
tags: [coherence, staleness, may, agent-config, dispatch, ghost-workflow, agents-send]
related: [KE-1658, KE-2057, KE-2053, KE-1667]
last_verified: 2026-06-20T02:00Z
---

<ai_context>
summary: "agents/may/agent.json line 24 contains a tool hint: 'Use agents.send(\"tech-lead\", task) for code changes. Tech-lead has workflows (implement-and-review, two-phase, verified-coder) for structured execution.' This contains three stale references: (1) agents.send was removed in commit d15c5249 and returns a deprecation error at runtime (KE-1658); the correct primitive is agents.fork() or agents.call(). (2) implement-and-review workflow has no implementation file anywhere (KE-2057). (3) two-phase workflow has no implementation in tech-lead/workflows/ (only verified-coder.ts and tech-lead-heartbeat.ts exist). Additionally, tech-lead is semi-dormant (last session 6.6 days ago) and dev is the active code-execution agent (325+ sessions/7d). The hint's dispatch advice would fail if may followed it literally: agents.send returns an error, the workflow names don't resolve, and tech-lead rarely runs. In practice, may uses agents.fork('dev', task) for code changes (per ORDER-003 and current standing-orders), so the stale hint is not causing active failures — but it is loaded into every may session as part of agent.json toolConfig, adding noise to may's context."
triggers: [coherence-audit, ghost-workflow, deprecated-api, may-config]
falsifiers:
  - F1: "If agents.send is re-implemented as an alias for fork/call, the dispatch primitive becomes valid." — Check runtime for agents.send handling.
  - F2: "If tech-lead is revived with implement-and-review/two-phase workflows, the hint becomes correct." — Monitor tech-lead sessions and workflow directory.
  - F3: "If may attempts agents.send('tech-lead', ...) and receives an error in a real session, the staleness has active cost." — Grep may error sessions for 'agents.send' or 'agents.message' deprecation errors.
</ai_context>

# KE-2065: may/agent.json Stale Tool Hint — agents.send + Ghost Workflows

## Observation

`agents/may/agent.json` line 24 contains:

```json
"hint": "Use agents.send(\"tech-lead\", task) for code changes. Tech-lead has workflows (implement-and-review, two-phase, verified-coder) for structured execution."
```

### Three stale references in one line:

| Reference | Status | Reality |
|-----------|--------|---------|
| `agents.send("tech-lead", task)` | **Deprecated** | `agents.send` removed in commit d15c5249; returns deprecation error (KE-1658). Correct: `agents.fork()` or `agents.call()` |
| `implement-and-review` workflow | **Non-existent** | No implementation file anywhere in codebase (KE-2057). Never existed as runtime code. |
| `two-phase` workflow | **Non-existent** | Not in `agents/tech-lead/workflows/` (only `verified-coder.ts` and `tech-lead-heartbeat.ts` exist) |

### Supporting context:

- **tech-lead** is semi-dormant: last session 6.6 days ago, no sessions in last 7 days at current rate
- **dev** is the active code-execution agent: 46 sessions/24h, dispatched via `agents.fork('dev', task)`
- The `verified-coder` workflow reference is technically correct (file exists) but invoked via tech-lead, which barely runs
- The actual code-change path per ORDER-003: `agents.fork()` to dev, or `workflow.run("verified-coder", ...)` via tech-lead

## Impact

**Low active risk, moderate context pollution.** May's agent.json hint is loaded into every may session (95 sessions/24h). The hint teaches an incorrect dispatch pattern, but:

1. May's standing-orders and common-sense.md override with correct patterns
2. May hasn't attempted `agents.send` recently (no deprecation errors in recent may sessions)
3. The hint is in a `toolConfig` section that may not be prominently surfaced

The risk is dormant but persistent: if a future may session attempts code dispatch and consults the hint, it will get a deprecation error on first attempt and need a retry.

## Recommended Fix

Replace the hint with current dispatch reality:

```json
"hint": "Use agents.fork(\"dev\", task) for code changes. For structured code changes with verification: workflow.run(\"verified-coder\", { task })."
```

This is a human-owned file change (`agents/may/agent.json`). Filing as a knowledge entry; a proposal may follow if the staleness causes active failures.

## Relationship to Prior KEs

- **KE-1658**: Documented the `agents.send` removal and design-doc fix (agents.md updated)
- **KE-2057**: Documented ghost workflow references in tech-lead/optimizer DOMAIN.md and TOOLS.md
- **KE-2053**: Standing-orders ORDER-003 also has stale project handler reference (separate fix)
- **KE-1667**: Fixed AGENTS.md workflow references but agent.json hints were not in scope
