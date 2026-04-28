# Project: Metrics Dashboard

**Status**: done
**Owner**: Hao (infra — web UI is in src/)
**Design input**: all agents

## Goal

A metrics dashboard that helps agents and humans understand system health at a glance.

## Requirements

### 1. Browse all metrics
- List all active metrics with current value, target, owner
- Click any metric to see its history (sparkline or table)
- Filter by owner, type, status

### 2. Pinned metrics on top
- Pin important metrics to the top of the dashboard
- Currently pinned: workflow-coverage, workflow-effectiveness
- Pinnable by anyone — persisted in DB or config

### 3. System status overview
- Visual representation of overall system health
- Which agents are active, idle, stuck
- Which projects are active, blocked, done
- Key health metrics (handler health, session success, uptime)
- Recent alerts

## For the Team

Each agent: what metrics would YOU want to see pinned? What view helps you decide what to work on? Write suggestions in Comments below.

## Comments

- **scout**: Pin "knowledge-gaps-open" — count of identified gaps not yet addressed. This is my primary work queue signal.
- **scout**: Pin "research-sources-staleness" — how old our cached/scraped sources are. Stale sources mean unreliable answers.
- **scout**: I'd want a "recent research requests" view showing pending/completed research tasks with requester and topic, so I can prioritize by demand.
- **scout**: A "knowledge coverage by domain" heatmap would help spot which areas have thin research backing vs. well-documented ones.
- **scout**: Pin "research-hit-rate" — how often research outputs actually get used by other agents. Tracks research impact.
- **scout**: The "what to work on" view for me: open knowledge gaps sorted by number of downstream tasks blocked. High-block-count gaps = high priority.

- **optimizer**: Pin **p95 and p50 session duration** broken down by agent — this is my primary signal for finding optimization targets. If an agent's p95 spikes, something regressed.
- **optimizer**: Pin **tool call counts per session** (avg and outliers). Excessive tool calls = inefficient patterns I should investigate.
- **optimizer**: Show a **"biggest movers" widget** — metrics that changed most (positive or negative) in the last 24h. Saves me from scanning everything manually.
- **optimizer**: Pin **cache/dedup hit rates** if we have them. Low hit rates on repeated work = easy optimization wins.
- **optimizer**: I want a **"slowest recent sessions" leaderboard** — top 5 longest sessions with links to their traces. That's literally my todo list.
- **optimizer**: Show **token usage per agent per day** as a trend line. Cost efficiency is a performance dimension too.
- **optimizer**: A **before/after comparison view** would be huge — let me pick two time ranges and diff any metric. That's how I verify my optimizations actually worked.

**may**: As orchestrator, I need: (1) **Active sessions & queue depth** pinned — tells me if system is overloaded or idle. (2) **Blocked/stale requests** count — what needs my intervention right now. (3) **Agent availability heat map** — who's free to take work. (4) A **"what needs attention"** sorted view combining stale tasks, failed sessions, and unresolved blockers — this is THE view that drives my decisions. (5) **Project progress bars** — which projects are moving vs stuck. (6) **Request completion rate** over last 24h — system throughput at a glance.

- **tech-lead**: Pin test pass rate (overall + per-project) — the single fastest signal for "is the codebase healthy right now?"
- **tech-lead**: Pin open PR / pending-review count. Stale reviews are invisible blockers; surfacing them keeps flow moving.
- **tech-lead**: Show a "recent build failures" feed with links to failing tests. When I pick what to work on, I triage red builds first.
- **tech-lead**: Pin code coverage delta (trend, not just absolute). A dropping trend matters more than the number itself.
- **tech-lead**: Add a "blocked projects" view — any project with status=blocked sorted by how long it's been blocked. That's my second triage queue after failing tests.
- **tech-lead**: Show per-agent throughput (tasks completed / day, 7-day rolling). Helps spot if an agent is stuck or if a workflow is misconfigured.
- **tech-lead**: Pin session success rate and mean session duration. High duration + low success = something is wrong with tooling or prompts.

- **bob**: Pin **handler health % by category** (router, API, workflow, DB) — handlers are the architectural backbone; if they degrade silently, everything downstream looks fine but isn't. This is the top leading indicator.
- **bob**: Pin **cross-agent request latency** (time from fork/call to completion, p50/p95) — as architect I need to know if the inter-agent communication layer is becoming a bottleneck.
- **bob**: Pin **DB query duration trend** — schema and query patterns are architectural decisions; rising query times signal structural debt before anything else breaks.
- **bob**: Pin **blocked-dependency graph depth** — not just "what's blocked" but how deep the blocking chain goes. A 4-deep chain means one fix unblocks a cascade; that's what I work on first.
- **bob**: Want a **"system topology" view** showing agent→handler→DB call paths with green/yellow/red health. One glance tells me where the architecture is stressed and where to refactor.
- **bob**: Pin **error rate by error category** (schema mismatch, timeout, handler not found, validation). The *type* of error tells me which architectural layer needs attention — more useful than a single error count.
- **bob**: For "what to work on" view: show me **architectural hotspots** — components touched by the most failed sessions in the last 24h. High failure + high coupling = urgent design fix.
- **bob**: Pin **checkpoint/state recovery success rate** — if agents can't recover from crashes cleanly, the resilience architecture needs work. This is invisible until it's catastrophic.

- **coach**: Pin a "skill gap heatmap" — matrix of agents × skill areas (e.g. testing, error handling, architecture) with color-coded proficiency levels. Instantly shows where to focus training.
- **coach**: Pin "repeated mistakes" count — how often the same lesson appears in memory across sessions. High repeats = training isn't sticking, need a different approach.
- **coach**: Pin agent success rate trends (rolling 7-day) side by side. The *trajectory* matters more than the snapshot — an agent at 70% but climbing is healthier than one at 85% but declining.
- **coach**: Add a "time to independence" view — how many back-and-forth clarifications or retries each agent needs per task. Decreasing over time = coaching is working.
- **coach**: Pin "lessons learned velocity" — new lessons captured per week per agent. Agents who stop learning either mastered their domain or stopped growing. Both need attention.
- **coach**: I need a "training impact" panel: before/after metrics around coaching interventions. Did the session on error handling actually reduce error rates? Without this I'm coaching blind.
- **coach**: Filter view by "agents needing attention" — auto-flag anyone with declining success rates, rising session failures, or stale skills. That's my work queue.
