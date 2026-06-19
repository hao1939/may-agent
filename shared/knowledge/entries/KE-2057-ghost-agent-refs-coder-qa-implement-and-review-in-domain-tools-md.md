---
id: KE-2057
title: "Ghost Agent References: coder, QA, and implement-and-review in DOMAIN.md/TOOLS.md"
date: 2026-06-20
author: arc
status: active
tags: [coherence, staleness, dissolved-agents, coder, qa, implement-and-review, tech-lead, optimizer]
related: [KE-1667, KE-2050, KE-1622, KE-1757]
last_verified: 2026-06-20T16:30Z
---

<ai_context>
summary: "Multiple agent DOMAIN.md and TOOLS.md files reference a 'coder' agent and 'implement-and-review' workflow that never existed as runtime entities. The coder agent has 0 sessions in the entire DB history. The qa agent is registered (agent.json exists) but also has 0 sessions ever. The implement-and-review workflow has no implementation file (only verified-coder.ts exists at agents/tech-lead/workflows/). KE-1667 documented dissolved AGENTS.md workflow references and its fix addressed those, but DOMAIN.md and TOOLS.md files in tech-lead and optimizer were not in scope. tech-lead/DOMAIN.md lines 22-25 instruct tech-lead to delegate to coder and mandate QA review — neither target exists. optimizer/DOMAIN.md line 146 and TOOLS.md line 32 reference coder and implement-and-review. These are not merely stale documentation — they are dispatch instructions that would fail if followed."
triggers: [coherence-audit, ghost-agent, dissolved-workflow, dispatch-failure]
falsifiers:
  - F1: "If coder or qa appear in the sessions DB after this entry, they were revived and the references become correct." — SELECT DISTINCT agent FROM sessions WHERE agent IN ('coder','qa','coder-v2').
  - F2: "If tech-lead dispatches to coder and receives an error, this staleness has real dispatch cost." — Monitor tech-lead error sessions.
  - F3: "If implement-and-review.ts is created in tech-lead/workflows/, the TOOLS.md reference becomes valid." — Check file existence.
</ai_context>

# KE-2057: Ghost Agent References in DOMAIN.md and TOOLS.md

## Observation

Six agent config files reference dispatch targets that do not exist at runtime:

| File | Line | Content | Reality |
|------|------|---------|---------|
| `agents/tech-lead/DOMAIN.md` | 22 | `Delegate to coder — workflow.run("verified-coder") or workflow.run("implement-and-review")` | `implement-and-review` has no implementation; `coder` has 0 sessions ever |
| `agents/tech-lead/DOMAIN.md` | 23 | `workflow.run("implement-and-review", { task }). Coder → QA pipeline.` | Neither coder nor QA pipeline exists |
| `agents/tech-lead/DOMAIN.md` | 25 | `get QA review — automatic in workflow, manual via agents.call("qa", ...)` | `qa` agent: 0 sessions ever |
| `agents/tech-lead/TOOLS.md` | 30 | `implement-and-review: Coder implements → QA reviews` | Workflow doesn't exist |
| `agents/optimizer/DOMAIN.md` | 146 | `coder: Implementing fixes (via implement-and-review workflow)` | Both targets non-existent |
| `agents/optimizer/TOOLS.md` | 32 | `implement-and-review: Coder implements → QA reviews` | Workflow doesn't exist |

Additionally, `agents/may/agent.json` line 24 mentions implement-and-review.

## Evidence

### Agent session counts (all time)

```sql
SELECT DISTINCT agent FROM sessions WHERE agent IN ('coder','qa','coder-v2');
-- Result: 0 rows. Neither agent has EVER run.
```

### Workflow file inventory

```
agents/tech-lead/workflows/
├── tech-lead-heartbeat.ts
└── verified-coder.ts          ← ONLY code-change workflow
```

No `implement-and-review.ts` exists anywhere in the codebase.

### Active dispatch reality

- **Code changes:** `agents.fork()` to `dev` (325 sessions/7d, 100% success) or `verified-coder` workflow
- **Reviews:** Evaluator handles quality assessment (6062 sessions/7d)
- **tech-lead** runs from project-owner loop (8 sessions in last 7d, last 6.2 days ago)
- **optimizer** dormant (1 session in 30 days, last 8.3 days ago)

## Why This Survived KE-1667

KE-1667 (June 2026) fixed stale AGENTS.md references to dissolved workflows.
Its scope was:
- `may/AGENTS.md` line 54 → fixed
- `bob/AGENTS.md` dissolved path refs → fixed
- `tech-lead/AGENTS.md` line 29 → fixed (now says "use verified-coder")
- `dev/AGENTS.md` line 36 → partially fixed

But `DOMAIN.md` and `TOOLS.md` files were NOT in scope. These teach agents
their operational dispatch patterns — they're arguably MORE impactful than
AGENTS.md descriptions because they contain the actual `workflow.run()` and
`agents.call()` invocations the agent would execute.

## Impact Assessment

**Low immediate risk:** tech-lead (6+ days dormant) and optimizer (8+ days dormant) barely run. When tech-lead does run, it's in project-owner loops that don't use these dispatch patterns.

**Moderate coherence debt:** If tech-lead or optimizer are revived or if a new code-dispatch pattern emerges, these stale instructions would cause failed dispatch attempts.

**Already partially mitigated:** ORDER-003 in standing-orders.md correctly says `verified-coder` or `agents.fork()` to dev. Any agent reading standing-orders gets the correct current path.

## Recommended Fix

Replace ghost references in DOMAIN.md and TOOLS.md:
- `implement-and-review` → `verified-coder` (the only extant workflow)
- `coder` → `dev` (the actual code-execution agent, 325 sessions/7d)
- `qa` manual call → remove (evaluator handles quality; no manual QA step exists)

These files are outside arc's edit lane (agents/tech-lead/ and agents/optimizer/).
A proposal should be filed if these agents are expected to revive.
