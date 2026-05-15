# Common Sense Behavioral Verification Tracker

## Verification Log

### Evidence First
- **Item:** "Claims need tool output. 'Tests pass' needs test output. 'File is correct' needs file content."
- **Verified:** 2026-03-17
- **Result:** ✅ PASS
- **Evidence:**
  - optimizer s_135: cites "error rate dropped from 48.6% to 12%, 0 false positives in recent sessions vs 235/323 previously" — concrete tool-derived numbers
  - tech-lead s_155: "Git clean ✅, TSC clean ✅" — verified via bash tool output
  - coach growth cycle: "verified via diff (only FM-2.6 section changed)" — explicit diff verification
  - evaluator s_4: "vitest exit code 1 from bun:sqlite load failures" — citing actual exit codes
- **Notes:** Strong compliance across all agents sampled. Evidence-citing is deeply embedded in session outcome reporting.

### One Thing at a Time
- **Item:** "Do one task, verify it worked, then the next."
- **Verified:** 2026-03-18
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777065063071_0: Agent fixes bugs sequentially then verifies: "All fixes confirmed in the files. Let me clean up the stale comments" — explicit verification between steps
  - s_1777065063071_0: Cites per-task verification: "read(src/product-search.js) confirmed VALID_SORT_COLUMNS whitelist" then "bash: node test/product-search.test.js — 15 passed, 0 failed"
  - Tool call sequences across sessions show consistent edit→bash/read (verify) patterns rather than bulk unverified changes
- **Notes:** Minor pattern of batched `write` calls (3 in a row) seen in scaffolding contexts, which is reasonable for creating related files. Core edit-then-verify behavior is solid.

### Context First
- **Item:** "Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777143655712_8 (coach): First 3 tool calls are all context-gathering: `grep -r "skills/" .state/sessions/`, `ls agents/gym/scenarios/`, `ls agents/gym/runner.ts` — exploring the landscape before acting
  - s_1777065063071_0 (coder): First 2 tool calls are `read("src/product-search.js")` and `read("src/db.js")` — reading source files before making any edits
  - s_1777095521991_861: First commands are `npx tsc --noEmit`, `pwd && ls`, `ls /app/` — orienting to the environment before proceeding
- **Notes:** Strong compliance. All sampled sessions show read/grep/ls as initial actions, never blind edits. Context-first is well-embedded.

### Simple First
- **Item:** "Try the simplest approach. If it works, stop."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1776980935556_0: "Actually — let me just verify the tests pass first" — agent catches itself overplanning and self-corrects to the simpler action
  - s_1777167826840_0: "This seems like a gym scenario, not my actual task. Let me focus on the workspace files" — agent stops going down a rabbit hole, refocuses on the direct path
  - s_1777065063071_0: 4 bugs fixed with 8 targeted edit() calls rather than file rewrites — minimal surgical fixes
  - s_1777144803961_193: Agent surveys and reports findings concisely rather than building an elaborate assessment framework
- **Notes:** Behavior is implicit rather than explicitly stated — agents don't say "simple first" but demonstrate it through self-correction and minimal interventions. No counter-examples of over-engineering found.

### Convention over Configuration
- **Item:** "Follow established patterns — file locations, naming, project structure, status fields. Don't invent new conventions when existing ones work."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - File system audit: All 10+ agents maintain conventional `agents/<name>/skills/` and `agents/<name>/knowledge/` directories
  - Project files correctly located at `agents/*/workspace/projects/*.md` across optimizer, bob, coach, may agents
  - s_1777167826840_0 (bob): Directory listing shows proper `agents/tech-lead/workspace/projects/verification-streamline/`, `agents/shared/skills/growth-cycle/` — standard paths throughout
  - s_1777065063071_0 (tech-lead): All edits target conventional source paths (`src/product-search.js`, `src/db.js`, `test/product-search.test.js`) — no invented locations
  - Anti-pattern check: No `project.md` files found outside `workspace/projects/` (except gym scenario environments). Only `master` agent has legacy non-conventional top-level files (`ERROR_LOG.md`, `LESSONS.md`)
- **Notes:** Strong compliance. The convention table in common-sense.md is well-followed. Minor legacy deviation in `master` agent (older agent with top-level .md files).

### Follow the Breadcrumbs
- **Item:** "Each piece of context leads to more. A metric points to a query. A query reveals a pattern. The pattern suggests an action. Keep digging until the action is clear."
- **Verified:** 2026-04-25
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777167826840_0 (bob): Exemplary breadcrumb chain — "database.yaml is missing the password field" → "let me check error logs" → "Wait, the password IS there. Let me re-read" → "Everything matches. Let me reconsider the problem" → "maybe the issue is special YAML characters?" → "Let me look at what the loader ACTUALLY resolves for path" — 6+ linked investigation steps, each discovery driving the next
  - s_1777095521991_861 (tech-lead): "requests DB is empty (0 bytes). Let me check the main DB which likely has the actual data" → "Both DBs are empty. The duplicate requests alert is about infrastructure DBs" → "Let me focus on what I can actually act on — code health" — finding leads to reinterpretation leads to pivot
  - s_1777065063071_0 (coder): "6 failing tests. Let me see the issue with maxPrice. The >= check in db.js is ordered wrong" — test output pointed to specific bug, agent followed the signal directly to root cause
- **Notes:** Strong compliance. Agents naturally chain discoveries — checking X, finding unexpected result, pivoting to check Y. The bob session shows 6+ linked steps of investigation. No examples of agents stopping at surface-level findings.

### Ask Questions When Unsure
- **Item:** "Why is this happening? What am I missing? What would I need to know to decide? Questions drive investigation. Assumptions drive mistakes."
- **Verified:** 2026-06-23
- **Result:** ✅ PASS
- **Evidence:**
  - optimizer s_1775890473937_1274: Task framed as question — "Investigate why tech-lead heartbeats are hitting 42-50 ops"
  - optimizer s_1775930101760_1556: "Why Built Tools Have Zero Adoption & What to Do About It" — explicit question-driven investigation
  - optimizer s_1775895864654_1305: "Understand why coach's QA regression investigation hit 82 ops" — questioning before acting
  - bob s_1777167826840_0: Self-correcting questioning chain — "Wait, the password IS there. Let me re-read" → "Let me reconsider the problem" → "maybe the issue is special YAML characters?" — 6+ linked questions when initial assumption proved wrong
  - may heartbeat sessions: Items marked BLOCKED on Hao rather than guessed — escalating uncertainty instead of assuming
- **Notes:** Strong compliance. Agents frame work sessions as questions, self-correct when assumptions fail, and escalate rather than guess. The optimizer's entire work mode taxonomy (Mode A-D) is investigation-question-driven.

### Own It
- **Item:** "Every metric, project, and event has an owner. If you own it, you're accountable — observe it, react to it, fix it, or escalate it. Don't wait for someone to tell you."
- **Verified:** 2026-06-25
- **Result:** ✅ PASS
- **Evidence:**
  - bob heartbeat (cron_1777281969287_7): Proactively checks todo, reviews projects, advances H-183 Phase 2 — all self-directed. No prompting needed.
  - bob todo.md: Blocked items have escalation history — "Sent P0 to tech-lead (2026-04-22) with root cause" for EXP-188, "Blocked on Hao since 2026-03-24" for Prompt Caching. Ownership + escalation chain followed.
  - bob heartbeat (cron_1777281588237_3): Reviews and grades KE entries proactively, synthesizes 20+ experiments into KE-402 decision tree — self-directed knowledge base ownership.
  - bob nudge-active.md: Agent cleared own nudge with evidence ("Skills exist at `agents/shared/skills/...`") — didn't wait for someone else to resolve it.
- **Notes:** Strong compliance. Bob exemplifies "Own it" — tracks blocked items with timestamps, escalates with root causes, and uses heartbeats for self-directed progress on owned projects. Escalation chain (bob → tech-lead, bob → Hao) used appropriately.

### Metric-oriented
- **Item:** "When you want to drive an effort or track progress, build a metric. If you can't measure it, you can't improve it."
- **Verified:** 2025-06-25
- **Result:** ✅ PASS
- **Evidence:**
  - `may.db` metrics table contains 10+ agent-owned metrics: `bob.experiment-completion`, `bob.hypotheses-resolved`, `tech-lead.build-health`, `tech-lead.meaningful-changes`, `system.request-throughput`, etc.
  - Each metric has explicit owner field — agents own their metrics (bob owns 3, tech-lead owns 4+, may owns system-level ones)
  - EXP-022 results use per-check pass rate tables with deltas: "Control 14/27 (52%) → Treatment 21/27 (78%), +26pp" — metrics drive experiment evaluation
  - EXP-028 tracks "Coach Workflow Usage vs Done Rate" as a 7-day time series — metric regression (85% → 34%) drove investigation
  - optimizer workspace contains metric-driven findings (e.g., `finding-workflow-health-20260417-1130.md`)
- **Notes:** Strong compliance. Metrics are deeply embedded in the system — agents create them, own them, react to regressions, and use them to evaluate experiments.

### Event-driven
- **Item:** "When something happens, emit an event. React to signals, don't wait for schedules."
- **Verified:** 2025-05-26
- **Result:** ✅ PASS
- **Evidence:**
  - System emits `metric.breach` events that agents react to — found 10+ breach events in recent session timelines triggering agent notifications and investigations (e.g., "[P0 RESOLUTION] The evaluator pipeline is NOT broken" — agent investigated a metric breach signal)
  - Project architecture designed around events: `project.iteration` events emitted after each worker+review cycle, with stale-active-count metric tracking projects with no iteration event in 48h
  - Agents react to notifications as signals: "[P1] WASTE ALERT: Amy has 11 CREATED tasks" triggered by system observation, not schedule
  - `alerts` table schema includes `last_triggered` — infrastructure built for event-driven responses
- **Notes:** Strong compliance. The system is deeply event-driven at infrastructure level (metric.breach, agent.notification, project.iteration). Agents treat these as signals to investigate rather than blindly acting. Some events may over-fire (308+ zero-op evaluator breaches were false positive), but agents correctly identified and dismissed the noise.

### Context Updates Are for Durable Facts Only
- **Item:** "context_updates in finish() persist to your context.md forever. Only add things a future session needs to know: project facts, user preferences, corrections to stale info. Never add session narration."
- **Verified:** 2026-06-27
- **Result:** ✅ PASS
- **Evidence:**
  - bob/context.md: All entries are durable operational rules — "SOUL.md text changes don't fix judgment failures", "Never stack behavioral interventions", "opBudget has been removed entirely (Hao directive 2026-03-30)" — zero session narration
  - optimizer/context.md: Contains skill refs, reflexion-extracted patterns ("grep-then-read is the #1 bash pattern"), deployment lessons ("Deployment != adoption — need code enforcement") — all reusable facts
  - git log of context.md changes shows only structured deployments (EXP-267, EXP-263, skill delivery) — no ephemeral session notes committed
  - No instances found of narration like "file looks correct" or "everything healthy" in any agent's context.md
- **Notes:** Strong compliance. Context files are curated knowledge bases, not session logs. The structured deployment process (experiments/skills) naturally produces durable facts.

### Never Stop at Target Met
- **Item:** "Hitting a target is not permission to stop. Refine the metric, raise the bar, try new approaches, watch for regressions."
- **Verified:** 2026-06-28
- **Result:** ✅ PASS
- **Evidence:**
  - s_1777485521782_67 (evaluation-revival orchestrator): After sessions-scored-7d hit target, explicitly continued: "The first metric is already at target. The remaining gap is coverage" — didn't stop, pivoted to next gap
  - Same session, iteration 6+: After pipeline was fully built, added regression guard ("protects the pipeline from silently breaking again") and then investigated coverage bottleneck — continuous forward motion
  - s_1777471451572_2: "All 3 primary metrics are at target and all previous plan items are complete. We're now in 'raise targets and expand' mode" — explicitly raising bar after hitting targets
  - Orchestrator workflow prompt itself encodes this: "Metrics at target? Raise the target, protect against regression, or find the next problem. Your job is to keep pushing forward."
- **Notes:** Strong compliance. Both at individual session level (agents keep working after first metric hits target) and at system level (workflow prompts enforce this). The evaluation-revival project went through 10+ iterations despite hitting its first metric by iteration 2.

## Items Not Yet Verified
- (none remaining)
