# Brainstorm: System Observability — "What's Happening and Where Are We Going?"

**Date:** 2026-03-13
**Context:** The agent system runs autonomously with 12 agents, ~26 cron jobs, and 3,500+ completed sessions. But right now, the only way to understand what the system is doing is to:
1. Read May's heartbeat summaries (reactive, narrow window)
2. Manually grep session logs and JSONL files
3. Read bulletin.md (massive, unstructured, append-only)
4. Check roadmap.md and focus-tasks.md (manual, often stale)

**The problem:** As a human operator, you can't quickly answer: *"What just happened? What's happening now? Where is the system heading? Is it making progress or spinning?"*

---

## The Gap Analysis

### What We HAVE
| Data Source | What It Shows | Limitation |
|---|---|---|
| `.state/sessions/` | Per-session meta (agent, task, status, duration) | Raw JSON files, no aggregation |
| `.state/memory/*.jsonl` | Per-agent task history with summaries | Per-agent silos, no cross-agent view |
| `.state/delegations.jsonl` | Parent→child delegation chains | Raw log, no graph/visualization |
| `.state/ops-receipts.jsonl` | Tool execution receipts (tests, commits) | Mostly test data, no summary |
| `.state/job-history.jsonl` | Cron job execution log | Just success/fail timestamps |
| `agents/shared/bulletin.md` | Research intel & announcements | 50KB+, append-only, no structure |
| `agents/shared/roadmap.md` | Strategic direction | Manual, updated by Bob |
| `agents/shared/focus-tasks.md` | Current work focus | Manual, often lags reality |
| `agents/may/workspace/todo.md` | Operational todo list | May-centric, not system-wide |
| May heartbeat summaries | System pulse every ~10min | Ephemeral, not persisted as structured data |
| `agents/shared/SIGNALS.md` | Scout deep research findings | Dense research, not operational |

### What We're MISSING
1. **Activity Timeline** — "What happened in the last hour, across all agents?"
2. **Work-in-Progress View** — "What is each agent actively doing right now?"
3. **Progress Tracking** — "Is the roadmap moving? What got shipped this week?"
4. **Agent Utilization** — "Who's busy, who's idle, who's churning on the same thing?"
5. **Decision Trail** — "Why was X dispatched? What led to Y being completed?"
6. **Trend Detection** — "Are sessions getting longer? Are error rates rising?"
7. **Strategic Coherence** — "Is the work being done aligned with roadmap priorities?"

---

## Proposed Solutions (Ranked by Impact/Effort)

### 1. 📊 `system-status` CLI Command (High Impact, Low Effort)
**What:** A single command (or tool) that generates a structured snapshot of the entire system.

```
$ pi status

🕐 2026-03-13 21:55 UTC | Uptime: 18h | Sessions today: 142

📋 ACTIVE NOW (4 sessions)
  bob      s_687  heartbeat #302     running 1m42s
  scout    s_685  deep-dive: SOUL    running 33min  ⚠️ long
  amy-kimi s_688  HB#258 XHS scan   running 5min
  may      s_0    (this session)     running 2min

📈 LAST HOUR
  ✅ 12 sessions completed (avg 48s)
  ❌ 1 error (bob→may delegation: stream error)
  🔄 3 delegations (bob→tech-lead, bob→evaluator, bob→optimizer)
  📝 3 philosophy updates applied (P93, P95, P98)

🎯 ROADMAP PROGRESS
  Security & Hierarchy (P84/P85)     ████████░░ 80% — impl ready
  Agent Growth Cycle                  ██████████ 100% — monitoring
  P53 Compliance                      ██████████ 100% — automated

🔴 BLOCKERS
  - GPT-5.2 auth token expired (needs Hao)
  - Master CLI tools missing (needs Hao)

💡 RECENT ACHIEVEMENTS (today)
  - P98 Evaluator Integrity added to philosophy
  - P53 bash guard implemented
  - Bob: P93 Infrastructure Resilience designed
  - Amy-Kimi: 25+ research articles processed
```

**Implementation:** Script that reads session metas, memory JSONL, job-history, todo.md, and roadmap.md, then formats a dashboard. Could be a bash script, a `.cjs` skill, or a new tool.

---

### 2. 📜 Auto-Generated Activity Log (High Impact, Medium Effort)
**What:** A rolling, human-readable log that captures significant events system-wide. Not raw session data — curated events.

```markdown
# System Activity Log — 2026-03-13

## 21:55 — bob dispatched optimizer for P93 Infrastructure Resilience
## 21:43 — may applied P98 Evaluator Integrity to philosophy.md
## 21:30 — coach detected May path hallucination, fixed via SOUL.md
## 21:22 — bob completed L3 delegation metrics design
## 20:15 — scout published 12 deep-dive research papers
## 19:30 — evaluator ran drift detection — all agents stable
## 18:00 — amy-kimi processed 25 XHS articles, 8 actionable
```

**Implementation:** Each agent's memory entry already has a summary. A periodic job (every 30min) could:
1. Read all `memory/*.jsonl` entries since last run
2. Filter to non-heartbeat, significant events
3. Append to `agents/shared/activity-log.md` (or `.state/activity-log.jsonl`)

This gives you a single file to `tail -50` and immediately know what happened.

---

### 3. 🧭 Weekly Digest / Sprint Report (High Impact, Medium Effort)
**What:** A periodic synthesis (daily or weekly) that answers "Where did the system move?"

```markdown
# Weekly Digest — Week of 2026-03-10

## Shipped
- L3 Collective Defense (drift detection + auto-revert)
- P53 Reasoning Core compliance audit (automated)
- Philosophy updates: P80-P98 (18 new principles)
- Agent Growth Cycle applied to Bob and Coder
- 12 Scout deep-dive research reports

## In Progress
- P84/P85 Security hardening (design complete, impl pending)
- Agent Growth Cycle monitoring (Coach organic usage)

## Research Insights (from Amy-Kimi / Scout)
- CLI-first validated by Perplexity CTO, community consensus
- AGENTS.md > Skills (100% vs 53%, Vercel study)
- Multi-turn failure taxonomy (5 mechanisms identified)
- Self-evolution prohibition validated (Shanghai AI Lab)

## Metrics
- Sessions: 847 total, 94% success rate
- Avg session duration: 52s (heartbeats), 3m12s (tasks)
- Delegations: 43 (38 success, 3 errors, 2 skipped)
- Agent utilization: Bob 28%, May 25%, Scout 15%, others <10%

## Concerns
- GPT-5.2 token expired (4 days, blocking evaluator)
- Bulletin.md at 50KB (needs pruning or restructuring)
- May heartbeats increasingly repetitive (no new work to dispatch)
```

**Implementation:** Bob or an evaluator-like agent generates this by reading:
- `memory/*.jsonl` (what each agent did)
- `delegations.jsonl` (collaboration patterns)
- `job-history.jsonl` (cron execution stats)
- `roadmap.md` / `focus-tasks.md` (strategic alignment)
- `todo.md` archive section (completed items)

---

### 4. 🔍 `trace` Command — Follow a Work Item End-to-End (Medium Impact, Medium Effort)
**What:** Given a topic (e.g., "P98 Evaluator Integrity"), trace its lifecycle across all agents.

```
$ pi trace "P98"

P98 Evaluator Integrity — Full Trace
─────────────────────────────────────
1. 21:10 bob designed P98 in workspace/brief-p98-evaluator-integrity.md
2. 21:15 bob dispatched may via agents.send()
3. 21:21 may read brief, applied to philosophy.md line 629
4. 21:22 may moved todo entry to archive
5. 21:30 bob re-dispatched may (didn't see completion)
6. 21:30 may confirmed already applied — closed as duplicate
```

**Implementation:** Search across `memory/*.jsonl`, `delegations.jsonl`, and session outputs for keyword matches. Present as a timeline.

---

### 5. 📉 Agent Performance Dashboard (Medium Impact, High Effort)
**What:** Per-agent metrics over time — are they improving, degrading, or stalling?

```
Agent Performance — Last 7 Days
────────────────────────────────
bob       87 sessions  avg 1m42s  ⬆ throughput  quality: 92%
may       234 sessions avg 48s    ➡ stable      quality: 95%
scout     12 sessions  avg 28min  ⬆ depth       quality: 88%
coach     45 sessions  avg 3m12s  ⬇ fewer runs  quality: 90%
evaluator 18 sessions  avg 35s    ➡ stable      quality: 94%
amy-kimi  68 sessions  avg 2m45s  ⬆ volume      quality: 85%
```

**Implementation:** Aggregate from memory JSONL + evaluator scores. Could be a periodic cron job that writes to `.state/agent-metrics.json`.

---

### 6. 🏗️ Bulletin Board Restructuring (Medium Impact, Low Effort)
**What:** The bulletin is 50KB+ and growing. Split it into:
- `bulletin-latest.md` — last 48 hours only (what's fresh)
- `bulletin-archive/YYYY-MM-DD.md` — historical entries
- `bulletin-index.md` — topic-based index (security, architecture, research, ops)

**Implementation:** A one-time migration + a cron job that rotates entries older than 48h to archive.

---

### 7. 🎯 Strategic Alignment Check (Low Impact, High Effort)
**What:** Periodic automated check: "Is the work being done aligned with roadmap priorities?"

Compare actual session activity (from memory JSONL) against stated roadmap goals. Flag drift: "80% of sessions are heartbeats, 15% are philosophy updates, only 5% are implementation tasks."

---

## Recommended Priority Order

| # | Tool | Impact | Effort | Do When |
|---|------|--------|--------|---------|
| 1 | `system-status` command | 🔴 High | 🟢 Low | **Now** — biggest bang for buck |
| 2 | Auto activity log | 🔴 High | 🟡 Med | **Now** — simple to add |
| 6 | Bulletin restructuring | 🟡 Med | 🟢 Low | **Now** — maintenance task |
| 3 | Weekly digest | 🔴 High | 🟡 Med | **Next** — needs #2 first |
| 4 | `trace` command | 🟡 Med | 🟡 Med | **Next** — useful for debugging |
| 5 | Performance dashboard | 🟡 Med | 🔴 High | **Later** — needs metric pipeline |
| 7 | Strategic alignment | 🟢 Low | 🔴 High | **Later** — overkill for now |

---

## Key Insight

The data already exists — 3,530 session histories, memory files for every agent, delegation logs, job history. The problem isn't collection, it's **aggregation and presentation**. 

The #1 tool to build is a **single-command system status** that reads what's already there and presents it in a human-digestible format. No new infrastructure needed — just a smart reader of existing files.

The #2 tool is an **auto-generated activity log** that turns per-agent memory entries into a unified system timeline. This gives you `tail -f` for the whole system.

Together, these two tools solve the core question: **"What's happening and where are we going?"**
