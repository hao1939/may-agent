# Project: Metrics Dashboard

**Status**: active
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
