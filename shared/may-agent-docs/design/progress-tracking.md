# Progress Tracking & Human Review

## The problem

The system produces a lot of work — 284 workspace files, 1130 knowledge updates, 37 skills, 80 gym scenarios, 14K evaluations in one week. But there's no good way to answer:

- **What happened today/this week?** The data exists (journals, commits, evaluations, requests) but it's scattered across agent workspaces, git logs, and SQLite tables. No aggregated view.
- **Was it good?** Evaluations score individual sessions but there's no trend view. Did quality improve? Are agents getting stuck less? Is the optimizer actually optimizing?
- **What should I pay attention to?** With 3900 requests/week, 95% are routine cron tasks. The human needs to see the 5% that matter: human requests and their outcomes, design decisions, new capabilities, regressions.
- **What did I ask for and did it happen?** Human requests complete with `summary: NULL` or a one-liner. No way to quickly verify "I asked for X, the system did Y, the result was Z."

## What humans actually ask

From the human-inputs.jsonl archive, the recurring questions:
- "what are agents working on?"
- "what did each agent do since yesterday?"
- "how's coach doing?"
- "why no one is working on X?"
- "show me the blocked actions"

These are all **progress review** questions. The human wants a curated summary, not raw data.

## Design: May produces a daily digest

Instead of building a dashboard that queries raw data (which we already have in the web UI), have **May write a daily digest** — a structured document that answers the recurring questions. May already has access to everything: the requests table, session transcripts, evaluations, agent journals, git commits.

### The digest

A markdown file written to `agents/shared/daily-digests/YYYY-MM-DD.md`:

```markdown
# Daily Digest — 2026-03-24

## Your Requests
| Request | Status | Agent | Duration | Outcome |
|---------|--------|-------|----------|---------|
| "investigate tool system" | ✅ Done | may→bob,tech-lead | 34min | Dynamic tool loading designed and implemented |
| "stop amy, use amy-kimi" | ✅ Done | may | 41s | Amy disabled, amy-kimi enabled |

## New Capabilities
- **7 new skills deployed** by optimizer: budget-before-act, state-check-before-action, stale-approach-fixation, coder-edit-discipline, delegation-verification, idempotent-work-detection, search-strategy-escalation
- **5 new gym scenarios** baselined by coach: read-before-edit, abandoned-branch, judgment-destructive-trap, red-herring-log, silent-dependency (4 ceiling, 1 infra-blocked)
- **Dynamic tool loading** merged (tech-lead). Agents can now have tools/ directories.

## Research Highlights
- Scout: DD#458 TrustFlow (vector reputation), DD#459 GoAgent (group-centric topology), CR#252 MAS Organizational Stack synthesis
- Bob: Control plane Phase 3 (Active Nudging) endorsed, Distributed Control synthesis

## Quality
- 279 sessions, 97% success rate
- Evaluation trend: avg quality 3.8→4.1 (improving)
- 4 failing gym scenarios remain: delegation-scope, sycophant, wrong-tool-args, exit-code-misread

## Issues
- 7 handlers broken on k3s (missing src/lib imports) — FIXED
- ConcurrencyGate causing cascading timeouts — REMOVED
- Optimizer writing to wrong workspace/ path — FIXED

## Agent Activity
| Agent | Sessions | Focus |
|-------|----------|-------|
| coder | 107 | Gym training runs |
| coach | 40 | Convention verification, growth cycles |
| optimizer | 38 | Skill lifecycle (7 deployed) |
| may | 32 | Request dispatch, system health |
| bob | 19 | Architecture synthesis, control plane |
| tech-lead | 17 | Active nudging, convention checks |
| qa | 16 | Quality checks |
| scout | 6 | arXiv Monday batch, 2 deep-dives |
```

### How it's generated

A cron job (daily, after all heartbeats have run) that:
1. Queries `requests` table for human requests and their outcomes
2. Queries `sessions` table for agent activity counts
3. Reads agent journals (`agents/*/workspace/journal.md`) for highlights
4. Reads `evaluations` table for quality trends
5. Checks git log in `agents/` for meaningful commits (skip auto-commits)
6. Writes the digest to `agents/shared/daily-digests/YYYY-MM-DD.md`
7. Pushes to telegram as a summary
8. Available in the web UI dashboard

### Two options for generation

**Option A: LLM-generated.** Run May with a digest-generation task. May reads all the data sources, synthesizes, and writes. Better summaries but costs tokens.

**Option B: JS handler (template-based).** A handler queries the DB and fills a template. Deterministic, zero LLM cost, but less insightful (can't synthesize research highlights or explain "why" something happened).

**Recommendation: Option B for structure, Option A for highlights.** The handler generates the quantitative parts (tables, counts, trends) and optionally asks May to write 2-3 sentences of highlights for each section. This caps the LLM cost to one short summary per day.

### Web UI integration

Add a `/api/digest` endpoint that returns the latest digest. The dashboard shows it as the landing page — the first thing you see when you open the web UI. Click any row to drill into the request/session.

The "Ask about this" button on digest items composes a context message for chat, same as on the request list.

### Telegram integration

The digest handler sends a condensed version to telegram — the "Your Requests" and "Issues" sections, plus a one-liner per agent. Full digest available via web UI link.

### What May can proactively tell you

Beyond the daily digest, May should surface things that need human attention without being asked:

- **Blocked requests**: "Your request X has been blocked for 2h — tech-lead says the finish guard needs platform access"
- **Regressions**: "Quality dropped 10% today — 3 agents hit OpBudget repeatedly"
- **Milestones**: "Optimizer deployed 5 new skills this week — all gym-tested"

These are notification events (the `type: "notification"` we defined in the event system) pushed to telegram and web UI.

## Implementation

1. **Daily digest handler** (`agents/may/handlers/daily-digest.ts`) — JS handler, queries DB + reads files, writes markdown + pushes telegram
2. **Web UI digest endpoint** (`GET /api/digest`) — serves the latest digest file
3. **Web UI landing page** — show digest as the first thing, not raw request list
4. **May heartbeat update** — add "check if digest was generated today" to heartbeat, generate if missing
