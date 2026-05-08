# UI redesign — operator-goal-driven

**Status**: draft (proposal, 2026-05-08)
**Author**: this session, in dialogue with operator
**Replaces**: nothing — refines `webui.md` to match what the operator actually does

## Reframing

`webui.md` describes five surfaces (`/`, `/projects/:id`, `/sessions/:id`, `/knowledge`, `/system`). That's a *taxonomy of pages*. The operator's actual goals are simpler:

| # | Goal | What it answers | Verbs needed |
|---|---|---|---|
| 1 | **System status** | Is the system healthy? | resolve alert, edit threshold |
| 2 | **Agents and projects** | What is everyone doing? | (read-mostly) |
| 3 | **Communicate / suggest** | Talk to an agent or project | message, comment, heartbeat-now |
| 4 | **Review knowledge** | Read what's been learned | search, follow KE/H/EXP refs |

The five-surface design is still right at the URL level — deep-linking, web-shareable, separable concerns. But **what the operator looks at first** should be the four goals, not the five surfaces.

Map:

- Goal 1 → `/system` surface, plus the `breach-badge` on every page.
- Goal 2 → `/` surface (Live) + `/projects` list + `/projects/:id`.
- Goal 3 → inline on `/projects/:id` (comment box) and `/sessions/:id` (message box) and `♥` button on `/`.
- Goal 4 → `/knowledge` surface, with search.

## Concrete problems found right now

1. **Project parser is broken.** `handleProjects()` parses `**Owner**: x` lines but every actual `project.md` (24/24 sampled) uses YAML frontmatter (`---\nowner: x\n---`). Result: every project shows `owner=unknown`, `status=unknown`. **The Projects table is currently useless.** This is goal 2's blocker.

2. **System tab groups by `owner`.** Owner is the wrong axis. The design says **Agency / Infrastructure / Output** because that's how operators think about health. Owner-grouping puts `evaluator.aftermath-coverage-rate-3h` next to `evaluator.low-quality-rate-24h` instead of near `handler.success-rate` (both infra) or `system.real-output-24h` (output). It also surfaces noise (e.g., `agent.dev.low-quality-streak` as a top-level row).

3. **Knowledge has 604 KE entries and no search.** A file tree of 604 entries is not browseable. Goal 4 fails for any specific question.

4. **No way to message an arbitrary agent.** The `♥ heartbeat-now` button only triggers a wake; you can't *say something* unless that agent has an active session. Goal 3 is half-met.

5. **No "what is X agent doing right now" view.** `/` shows heartbeat bars per agent but clicking an agent does nothing structured. Goal 2 needs an *agent* view, not just a *project* view.

## Redesign — minimal changes per goal

### Goal 1 — System status

**Change**: System tab regrouped from `by owner` → **Agency / Infrastructure / Output** (the design's own taxonomy).

Mapping rule (cheap, explicit, in JS):
- `agent.*`, `capability.*` → **Agency**
- `handler.*`, `session.*`, `evaluator.*`, `metric.*`, `v2.*` → **Infrastructure**
- `project.*`, `system.*` → **Output**

Within each group: alerting first, then by speed (fast/slow), then alphabetical.

The breach-badge already covers the "is anything wrong?" case from any other tab.

**Verbs**: keep existing (`resolve alert`, `edit threshold`).

**Cuts**: the "Recent Snapshots" stream at the bottom of System is operator noise — move to a `<details>` collapse.

### Goal 2 — Agents and projects

**Fix**: rewrite `handleProjects()` to parse YAML frontmatter. It's a 20-line change that makes the entire Projects view come alive.

**Add a per-agent strip on `/`** above the heartbeat timeline:

```
agents · click to filter
[may]  [optimizer]  [evaluator]  [scout]  [arc]  [bob]  [coach]  [dev]  [judge]  [qa]  [tech-lead]
```

Clicking an agent name routes to `#/agents/<name>` which shows:
- The agent's last 24h heartbeat outcomes (already in `/api/liveness`)
- The agent's open projects (filtered from `/api/projects?owner=<name>`)
- The agent's recent decisions
- A **"send message" box** (goal 3)

This adds ~50 LOC but covers a goal we don't have today: "what is X doing?"

**Project detail (`/projects/:id`)** stays roughly as designed but gets:
- A small **pulse strip** at the top (last iteration / last comment / metric health) — done in webui.md mock, missing in current UI
- The four sub-tabs (Project, Journal, Discussion, Sessions) are kept; they work
- The comment box already exists and works. Good.

### Goal 3 — Communicate / suggest

Today we have:
- `♥` button: triggers heartbeat-now for an agent (no payload).
- Project comment box: writes to discussion, agent sees next heartbeat.
- Session message box: routes through WebSocket, only works for active sessions.

**Missing**: drop a message to an arbitrary agent without picking a session.

**Add a single endpoint**: `POST /api/agents/:name/message` — appends to `agents/<name>/inbox.md` (or whatever convention exists; need to check) so the agent reads it on next heartbeat. Simpler than session routing.

Surface it as a textarea on the new agent view (`#/agents/<name>`).

**Defer**: telegram, multi-agent broadcast, threading. Not goals 1-4.

### Goal 4 — Review knowledge

The `/knowledge` surface currently shows a tree only. With 604 KE entries, this is unusable.

**Add**: a single text input at the top of `/knowledge` that filters the tree by filename + first-line content. Pure client-side, no new endpoint — `/api/browse` returns the tree, the filter runs in JS.

**Add**: when an entry references `KE-NNN` / `H-NNN` / `EXP-NNN`, those are already linkified by `linkifyRefs()`. Already done in commit `0db40723`. ✓

**Defer**: full-text search across file bodies (needs a server-side index). The filename + first-line filter covers 80% of the case ("which entry was about heartbeat detection?") at zero cost.

## What this is NOT doing

- Not adding new event types.
- Not changing the URL structure (deep links keep working).
- Not adding a framework or build step.
- Not replacing the sidecar Live/Projects/Sessions/Knowledge/System tabs — they stay; we just *fix* their content.

## Smallest-blast-radius order

1. **Fix `handleProjects()` YAML parser** — backend, 20 LOC. Unblocks goal 2 immediately.
2. **Regroup System tab by Agency/Infra/Output** — frontend, 30 LOC. Unblocks goal 1.
3. **Add `#/agents/<name>` view** — frontend, ~80 LOC. New surface; data already exists in `/api/liveness` + `/api/projects`.
4. **Add `POST /api/agents/:name/message`** — backend ~30 LOC + frontend textarea ~10 LOC.
5. **Add knowledge filter input** — frontend, ~25 LOC.

Total: ~195 LOC, 5 commits, each independently testable + revertable.

## Open questions for operator

1. **Inbox convention** — does each agent already have an `inbox.md` or similar that the heartbeat handler reads? (I'll check `agents/shared/may-agent-docs/sessions.md` and `manual/`.)
2. **Knowledge search scope** — entries only, or hypotheses + experiments too? (Tree filter handles all three uniformly; no decision needed.)
3. **Stale projects** — should `status: waiting` projects (auto-paused after no decision) appear in goal 2 by default? Currently 1 project (the one I read) is waiting. Suggest: show, but visually muted.
