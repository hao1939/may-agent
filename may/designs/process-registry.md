# Process Registry — May-Agent System

**Last audited**: 2026-03-30
**Total processes**: 18 identified

---

## 🟢 Working Well — Clear Value

### 1. Heartbeat System (Agent Scheduling)
- **What**: Each agent has a cron that fires a heartbeat prompt every 30m-2h, triggering the agent to check for work and act.
- **Infrastructure**: `agents/may/cron.json` → `src/app/cron.ts` → `manager.run()`
- **Status**: ✅ All 9 agents have heartbeats, 8 enabled (Amy disabled intentionally — replaced by Amy-Kimi)
- **Value**: This IS the nervous system. Without it, agents sit idle forever.
- **Metrics (24h)**: 186 sessions fired across all agents
- **Issues**: None — this is the most reliable process we have.

### 2. Request Tracking (Task Database)
- **What**: SQLite DB tracks every task from creation → assignment → completion. Enables cross-agent coordination.
- **Infrastructure**: `src/lib/requests.ts` → `.state/may.db`
- **Status**: ✅ 10,326 requests tracked, 97% completion rate
- **Value**: Single source of truth for "who asked whom to do what." Essential for accountability.
- **Issues**: None critical.

### 3. Session Persistence & Recovery
- **What**: Every agent session is persisted to disk, can be resumed after crash/restart.
- **Infrastructure**: `src/lib/persistence.ts` → `.state/sessions/`
- **Status**: ✅ 15,538 sessions tracked
- **Value**: No lost work on restart. Chat sessions survive crashes.
- **Issues**: None — battle-tested.

### 4. Convention Compliance Checking
- **What**: Mechanical checks on every session for protocol compliance (read-before-edit, verify-writes, etc.)
- **Infrastructure**: `agents/may/handlers/convention-check.ts` → convention_checks DB table
- **Status**: ✅ 19,976 checks run, 30+ conventions tracked
- **Value**: Hard data on where agents fail. Top findings:
  - C12.1: 6% pass rate — **worst convention** (needs investigation)
  - C1.3 (verify-writes): 47% — agents still skip read-back after edit
  - C1.1 (read-before-edit): 67% — improving but still failing 1/3 of time
- **Issues**: Data is rich but **nobody is acting on it systematically**. The convention check fires every 30min, stores results, but the feedback loop to agents is weak.

### 5. Session Evaluation (Heuristic)
- **What**: Auto-scores every session on quality/efficiency using mechanical heuristics (no LLM).
- **Infrastructure**: `agents/may/handlers/evaluate-sessions.ts` → evaluations DB table
- **Status**: ✅ 16,297 evaluations, 76% done by heuristic (cheap)
- **Value**: Identifies worst-performing sessions without burning LLM tokens.
- **Issues**:
  - `evaluate-session-llm` cron is disabled (expected), but **coverage is still low**: last 24h `sessions=5434` vs `evaluations=1958` (≈36% coverage). This indicates either (a) we intentionally skip many session kinds, (b) the evaluation sync/handler scope is too narrow, or (c) sessions are being generated faster than the handler processes them.

### 6. JS Handlers (Cheap Automation)
- **What**: Pure-JS cron handlers that do infra work without LLM calls.
- **Infrastructure**: `agents/may/handlers/*.ts`, 22 handlers
- **Status**: ✅ Running reliably — watchdog, zombie-cleanup, auto-commit, error-log-scanner, etc.
- **Value**: HUGE cost savings. These run every 30min-24h and cost zero LLM tokens.
- **Handlers**: watchdog, zombie-cleanup, evaluate-sessions, convention-check, system-status, daily-brief, coaching-report, tracker-compact, agents-auto-commit, lessons-graduation, error-log-scanner, audit-requests, workspace-compaction, memory-trimmer, tool-quality-scan, heartbeat-context, active-nudge, daily-digest
- **Issues**: Some may be redundant or overlapping. Needs audit of actual value per handler.

### 7. Context Learning (finish → context.md)
- **What**: When agents call `finish(context_updates: [...])`, facts are persisted to `agents/<name>/context.md` and loaded into future sessions.
- **Infrastructure**: `src/lib/context-learn.ts` → `manager.ts` line 880
- **Status**: ✅ All 11 agents have context.md (8-14 lines each)
- **Value**: Agents remember environment facts (no npx, /app root, etc.) across sessions.
- **Issues**: Context files are small (8-14 lines). Agents may not be calling `finish(context_updates)` often enough. The learning is passive — only fires when agents explicitly include updates.

### 8. Compaction (Context Window Management)
- **What**: Summarizes old conversation history to prevent context overflow in long sessions.
- **Infrastructure**: `src/lib/compaction.ts` — triggered when token count exceeds threshold
- **Status**: ✅ Working — this session has been compacted multiple times
- **Value**: Essential for long-running chat sessions and complex multi-step tasks.
- **Issues**: None — well-tested.

---

## 🟡 Partially Working — Value Unclear or Underused

### 9. Agent Gym (Training Infrastructure)
- **What**: 117 scenarios that test agent behavior in controlled environments. Coach runs experiments.
- **Infrastructure**: `test/gym/` — runner, harness, scenarios. `gym_runs` DB table.
- **Status**: 🟡 152 runs total, 66% pass rate (101/152). Running but...
- **Value**: Theoretical value is high — evidence-based training. But...
- **Issues**:
  - **Coach experiments often hit ceiling effect** — agents already pass most scenarios at baseline
  - **252 experiment entries** in coach journal but unclear how many led to actual agent improvements
  - **No gym state dir** (.state/gym/ is empty) — results may not persist properly
  - **Disconnected from skill library** — gym tests skills but LIBRARY.md is all "untested"

### 10. Skill System
- **What**: 40+ skill markdown files in `agents/shared/skills/` that agents can reference.
- **Infrastructure**: Skill files + newly created LIBRARY.md + gym integration
- **Status**: 🟡 Skills exist but ALL marked "untested" in LIBRARY.md. No proven deployments tracked.
- **Value**: Potentially high — reusable behavioral guides. But...
- **Issues**:
  - **No skill has been through the full lifecycle**: discovered → gym-tested → proven → deployed
  - **Skill-lifecycle workflow exists** but may never have completed successfully
  - **Skills are injected by naming in SOUL.md** but we don't know which ones actually help

### 11. Growth Cycle / Training Sprint
- **What**: Coach-run workflow: fork agent → apply behavioral patch → gym test → promote if better.
- **Infrastructure**: `agents/coach/workflows/growth-cycle.ts`, cron: training-sprint (daily)
- **Status**: 🟡 252 experiments logged, Coach runs daily, but...
- **Value**: The machinery works. The question is whether improvements stick.
- **Issues**:
  - **Convention compliance hasn't improved dramatically** (C1.3 still at 47%)
  - **Many experiments hit ceiling effect** (agents pass baseline already)
  - **No clear "before vs after" dashboard** showing improvement over time

### 12. Common Sense System
- **What**: Shared behavioral principles that Coach verifies (every 4h) and Bob infra-checks (daily).
- **Infrastructure**: `agents/shared/common-sense.md` (14 lines), verified by `common-sense-verify` and `common-sense-infra` crons
- **Status**: 🟡 Only 14 lines. Very minimal.
- **Value**: Gives agents shared behavioral ground rules. But it's tiny — 14 lines feels like it should be richer.
- **Issues**: 
  - Is this adding value beyond what CONVENTIONS.md already provides?
  - Coach verifies it but doesn't seem to update it based on evidence

### 13. Workflow Engine
- **What**: Multi-step orchestrated workflows (code-review-loop, evidence-gate, skill-lifecycle, etc.)
- **Infrastructure**: `src/lib/workflow.ts`, `agents/shared/workflows/`
- **Status**: 🟡 7 workflows defined. Unclear how often they're used.
- **Value**: Structural enforcement > text instructions. When used, they prevent common failure modes.
- **Issues**:
  - **tech-lead has 17 errors in 24h** — all `jsonSchema.properties` undefined — workflows may be broken
  - **Usage tracking is poor** — we don't know which workflows run and succeed
  - Code-review-loop is the most valuable but may not be triggered consistently

---

## 🔴 Broken or Not Working

### 14. Tech-Lead Pipeline
- **What**: Tech-lead receives tasks from May, orchestrates coder+QA to build things.
- **Status**: 🔴 **17/29 sessions errored in last 24h** (59% failure rate)
- **Error**: `undefined is not an object (evaluating 'jsonSchema.properties')` — every single failure
- **Impact**: HIGH — this is the only path for getting code written. May dispatches to tech-lead, tech-lead is broken.
- **Blocking**: opBudget removal task, unified client architecture task, all future dev work

### 15. LLM-Based Evaluation
- **What**: Deep evaluation of session quality using an LLM evaluator agent.
- **Status**: 🟡 `evaluate-session-llm` cron appears **disabled in cron config**, but the DB shows evaluations are still being written recently (likely via handler-driven evaluation).
- **Impact**: Medium — we only get heuristic scores (mechanical checks), missing nuanced quality feedback
- **Why disabled?**: Likely cost concerns or previous bugs

### 16. Research Pipeline (Scout → Coach → Agents)
- **What**: Scout discovers research, Coach evaluates, May deploys.
- **Status**: 🔴 **Pipeline exists but has no successful end-to-end completion**
- **Evidence**: Scout runs heartbeats but the superpowers eval (dispatched 30min ago) is the first explicit research-to-skill task
- **Issues**: No tracking of "research in → skill adopted" — each step works in isolation

---

## ⚪ Disabled / Deprecated

### 17. Consolidate Memory (replaced by context-learn)
- **Status**: ❌ Disabled for all 9 agents (today's migration)
- **Replaced by**: Context learning via `finish(context_updates)`

### 18. Project Monitor
- **Status**: ❌ Disabled (`project-monitor` cron)
- **Unknown**: Why it was disabled, what it did

---

---

## Process Ownership

Every process has a single owner. The owner's job:
- **Push the process to deliver value** — not just run, but produce results
- **Report blockers** — if the process is stuck, escalate to May
- **Evolve or kill** — if the process isn't adding value, propose changes or deprecation

| # | Process | Owner | Why This Owner |
|---|---------|-------|----------------|
| 1 | Heartbeat System | **May** | Core scheduling — May owns system operations |
| 2 | Request Tracking | **May** | Cross-agent coordination — May is the hub |
| 3 | Session Persistence | **Bob** | Infrastructure architecture — Bob designs, tech-lead builds |
| 4 | Convention Compliance | **Coach** | Coach already runs gym + training. Convention data should drive what Coach trains on. Close the loop: low compliance → coaching target |
| 5 | Session Evaluation | **Evaluator** | Already owns this — evaluate sessions, produce quality signals |
| 6 | JS Handlers | **Bob** | Infrastructure code — Bob architects, ensures handlers aren't redundant |
| 7 | Context Learning | **Coach** | Learning system — Coach decides what agents should remember, reviews what's being learned |
| 8 | Compaction | **Bob** | Core infrastructure — Bob architects context management |
| 9 | Agent Gym | **Coach** | Already owns gym. New mandate: connect gym results → skill library → agent deployment |
| 10 | Skill Library | **Coach** | Already assigned (this session). Own discovery → test → prove → deploy lifecycle |
| 11 | Growth Cycle | **Coach** | Already runs experiments. New mandate: track before/after metrics to prove impact |
| 12 | Common Sense | **Coach** | Already verifies. Should merge redundant docs (common-sense vs best-practices vs lessons) |
| 13 | Workflow Engine | **Bob** | Infrastructure — ensure workflows are functional, track usage |
| 14 | Tech-Lead Pipeline | **May** | May dispatches work to tech-lead. May must fix the blocker and ensure delivery works |
| 15 | LLM Evaluation | **Evaluator** | Natural extension of process #5. Decide if LLM eval should be re-enabled or removed |
| 16 | Research Pipeline | **Scout** | Scout discovers, delivers to skill library. Own the discovery end of the pipeline |
| 17 | Consolidate Memory | **—** | Deprecated. Remove disabled crons from config. |
| 18 | Project Monitor | **—** | Disabled. Investigate or remove. |

### Ownership Summary by Agent

| Agent | Processes Owned | Focus |
|-------|----------------|-------|
| **May** | #1 Heartbeat, #2 Requests, #14 Tech-Lead Pipeline | System operations + delivery pipeline |
| **Bob** | #3 Persistence, #6 JS Handlers, #8 Compaction, #13 Workflows | Infrastructure health |
| **Coach** | #4 Conventions, #7 Context Learning, #9 Gym, #10 Skills, #11 Growth, #12 Common Sense | Agent improvement — THE improvement owner |
| **Evaluator** | #5 Session Eval, #15 LLM Eval | Quality measurement |
| **Scout** | #16 Research Pipeline | Discovery + external knowledge |

### How Owners Drive Their Processes

Ownership without a mechanism is just a label. Here's the **concrete driving mechanism** for each owner:

#### Available Levers (what any agent can do)

| Lever | How | Who Has It |
|-------|-----|------------|
| **Read files** | `read()` tool | All agents (via "coding" preset) |
| **Run bash** | `bash()` tool — query DB, parse logs, compute metrics | All agents with "coding" |
| **Write files** | `edit()`/`write()` — update docs, configs, heartbeats | All agents with "coding" |
| **Delegate work** | `agents(action: "send")` — assign tasks to other agents | May, Bob, Coach, Optimizer, Tech-lead |
| **Schedule recurring** | `cron()` — create/update cron jobs | May (via cron preset) |
| **Report up** | `finish(new_items)` — create tracked requests for May | All agents |
| **Persist learning** | `finish(context_updates)` — update own context.md | All agents |
| **Run workflows** | `workflow()` — multi-step automated sequences | Coach, Optimizer, Tech-lead |

#### Per-Owner Driving Plan

**May — System Ops + Delivery (3 processes)**

| Process | How to Drive | Specific Actions |
|---------|-------------|------------------|
| #1 Heartbeat | Review cron health each heartbeat | `bash`: query cron fire counts, check which agents haven't run in >2h. Adjust intervals. Disable agents that waste budget. |
| #2 Request Tracking | Triage on each heartbeat | `system_status()`: check stale requests. `agents(send)`: re-assign or close stale items. Track completion rate. |
| #14 Tech-Lead Pipeline | Fix blocker, then monitor delivery | `bash`: investigate jsonSchema.properties error → find root cause → `edit()` fix. Then track tech-lead success/fail rate each heartbeat. |

**Bob — Infrastructure (4 processes)**

| Process | How to Drive | Specific Actions |
|---------|-------------|------------------|
| #3 Session Persistence | Monitor recovery success rate | `bash`: check for lost sessions in logs. If sessions are being lost, design fix → implement via `edit()`. |
| #6 JS Handlers | Audit handler value | `bash`: measure which handlers fire, how often. `read()` each handler, evaluate if it's adding value. `edit()` to remove dead ones. |
| #8 Compaction | Tune quality | `bash`: sample compacted sessions, measure info loss. `read()` compaction prompts, `edit()` to improve them. |
| #13 Workflows | Track usage + fix broken ones | `bash`: grep for workflow executions in logs. Identify which workflows are used/broken. `edit()` to fix or deprecate. |

**Coach — Agent Improvement (6 processes)**

| Process | How to Drive | Specific Actions |
|---------|-------------|------------------|
| #4 Convention Compliance | Close the feedback loop | `bash`: query convention DB (`sqlite3` on persist DB → get per-agent, per-convention scores). Identify lowest-scoring conventions. Write targeted training materials. Push to agent context.md via `agents(send)` to May. |
| #7 Context Learning | Curate what agents remember | `bash`: `cat agents/*/context.md` → review accumulated facts. `edit()` to prune stale/wrong facts. Identify gaps where agents keep making the same mistake. |
| #9 Agent Gym | Connect results to deployment | `bash`: review gym results in `agents/coach/gym-results/`. Track pass rates by skill. When a skill reaches >80% pass rate → mark as proven → push to deployment via `workflow()`. |
| #10 Skill Library | Own the lifecycle | `read()` skill files. `bash`: find which skills are actually used in sessions (grep logs). Kill unused skills. Write gym scenarios for unproven ones. Track: discovered → tested → proven → deployed. |
| #11 Growth Cycle | Before/after measurement | `bash`: record metric baseline BEFORE an experiment. After N sessions, re-measure. `write()` results to `agents/coach/experiments/`. Kill experiments with no measurable impact after 1 week. |
| #12 Common Sense | Consolidate guidance docs | `read()` all 4 overlapping docs. `edit()` to merge into 1-2 canonical docs. Ensure every rule has a measurable convention check. Delete rules that can't be verified. |

**Evaluator — Quality (2 processes)**

| Process | How to Drive | Specific Actions |
|---------|-------------|------------------|
| #5 Session Evaluation | Produce actionable quality signals | `bash`: run evaluation on recent sessions, compute trends. `write()` weekly quality report to `agents/evaluator/reports/`. `finish(new_items)`: flag quality regressions to May. |
| #15 LLM Evaluation | Decide: revive or kill | `bash`: estimate cost of LLM eval vs. heuristic eval accuracy gap. If LLM eval adds <5% accuracy over heuristic, recommend deprecation. `finish()` with recommendation. |

**Scout — Discovery (1 process)**

| Process | How to Drive | Specific Actions |
|---------|-------------|------------------|
| #16 Research Pipeline | Deliver usable artifacts | `scrape()`: find relevant techniques/tools. `write()` findings to `agents/scout/discoveries/`. `finish(new_items)`: propose skills to Coach. Key metric: how many Scout discoveries became proven skills? If zero → fix the handoff. |

#### The Heartbeat is the Main Driver

The most important mechanism: **each owner checks their process health during every heartbeat**. This means adding a section to each owner's heartbeat.md:

```markdown
## Process Ownership Check
For each process you own, on EVERY heartbeat:
1. Query the current metric (bash: query DB or read file)
2. Compare to last known value (stored in your context.md)
3. If degrading → investigate and fix this heartbeat
4. If stagnant → try a new approach
5. If improving → document what's working
```

This is how the **heartbeat becomes the accountability loop**: the process health check runs automatically on every wake-up. No human has to remind anyone.

**Status: ✅ DEPLOYED** — All 5 agent heartbeats now include their process ownership check sections (May, Bob, Coach, Evaluator, Scout).

### Key Design Decisions

1. **Coach owns ALL improvement processes** (6 total). This is intentional — one owner for the entire "make agents better" loop. Avoids the fragmentation problem where gym, skills, conventions, and training are owned by different agents who never coordinate.

2. **Bob owns ALL infrastructure processes** (4 total). Architecture + maintenance. If a handler is redundant, Bob proposes removal. If compaction needs tuning, Bob designs it.

3. **May owns delivery** — the path from "Hao asks for something" to "code gets written." If tech-lead is broken, May fixes it. No delegation of the delivery pipeline.

4. **No shared ownership** — every process has exactly one owner. If two agents need to coordinate (e.g., Coach needs Bob to build gym tooling), they use the request system.

---

## Key Findings

### 🔥 Critical Blocker
**Tech-lead is broken** — 59% error rate, all `jsonSchema.properties` error. This blocks ALL code delivery. **Owner: May (fix immediately)**

### 💰 Biggest Unrealized Value
1. **Convention compliance data** — We have 20K checks but the feedback loop to agents is weak. C1.3 (verify-writes) is at 47% with no improvement trend. **Owner: Coach**
2. **Skill library** — 40+ skills, 117 gym scenarios, zero proven deployments. **Owner: Coach**
3. **Gym infrastructure** — Rich but disconnected from actual agent improvement. **Owner: Coach**

### 🧹 Cleanup Opportunities
1. **Redundant docs**: common-sense.md (14 lines) vs CONVENTIONS.md (140 lines) vs best-practices.md (73 lines) vs LESSONS.md (64 lines) — too many overlapping guidance docs. **Owner: Coach** — merge or clarify boundaries
2. **Disabled crons**: 11 disabled crons cluttering the config. **Owner: Bob** — clean up
3. **Coach heartbeat**: 200+ lines of instructions — too complex. **Owner: Coach** — simplify own heartbeat

### 📊 Process Health Summary
| Category | Count | Status |
|----------|-------|--------|
| ✅ Working well | 8 | Core infrastructure solid |
| 🟡 Partial value | 5 | Need tightening or measurement |
| 🔴 Broken | 3 | Need immediate attention |
| ⚪ Disabled | 2 | Clean up or remove |
