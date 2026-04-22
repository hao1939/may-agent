# Journal

## 2026-06-20 — M1 + M2 created

### M1: Gym scenario `breadcrumb-reaction`
Created `agents/gym/scenarios/breadcrumb-reaction/` with:
- `scenario.json` — tagged `breadcrumb-gap`, `M1`, standard tier
- `task.md` — heartbeat with breadcrumb-annotated metrics (`→ Quick check:` hints) but NO question-framing. Isolates breadcrumb effectiveness.
- `environment/stuck-requests.json` — investigation target the breadcrumb points to
- `success_criteria.js` — two checks: `reacted-to-stuck-requests` (any metric action) + `followed-breadcrumb` (used the specific hint)
- `setup.md` — design rationale and comparison table vs `metric-reaction-G-breadcrumb`
- `checks.md` — human-readable pass criteria and interpretation matrix

This scenario pairs with the existing `metric-reaction-G-breadcrumb` (which has question-framing + breadcrumbs) for A/B comparison in M3.

### M2: Question-framing proposal
Wrote `m2-question-framing-proposal.md`:
- Proposes changing heartbeat step 1 to a reasoning question when ⚠️ metrics exist
- Includes before/after markup, pseudocode patch for `agent-heartbeat.ts`, and design decisions
- Conditional activation (only on alerts) mitigates KE-008 risk
- Validation plan: gym A/B (M3) → single-agent deploy (M4) → production measurement (M5)

### Next steps
- **M3b**: Re-run after fixing gym transcript bugs (see below)
- **M4**: If validated, implement the `agent-heartbeat.ts` patch for coach agent
- **M5**: Monitor `coach.breadcrumb-action-rate` ≥0.8 for 1 week

## 2026-06-20 — M3 attempted (BLOCKED by infra bugs)

### M3: Gym A/B comparison — breadcrumb-only vs question-framing
Ran both scenarios 5× each using `may-agent --oneshot --agent coach`:
- `breadcrumb-reaction`: 0/5 pass (both checks)
- `metric-reaction-G-breadcrumb`: 0/5 pass

**Results are invalid.** Two infrastructure bugs prevent meaningful scoring:

1. **File naming mismatch**: `gym-score-utils.cjs` reads `_gym_transcript.jsonl` but `runner.ts` writes `transcript.jsonl` → `hasTranscript()` always false → all behavioral checks auto-fail
2. **Nested session capture**: Runner grabs parent session's JSONL from `.state/sessions/` instead of child agent's transcript

Manual inspection confirms the agent DID react to stuck-requests (wrote triage note about it). Full results in `m3-results.md`.

### Bugs to fix (blocking M3b)
- [ ] `agents/gym/lib/gym-score-utils.cjs` line 67: change `_gym_transcript.jsonl` → `transcript.jsonl` (or fix runner to write correct name)
- [ ] `agents/src/gym/runner.ts` ~line 395: session lookup grabs outer session when runner itself is an agent — needs session-ID scoping

### Decision
Proceed to M4 based on KE-215 evidence (100% vs 10%). Gym validation deferred to M3b after infra fix.

## 2026-06-27 — M4 analysis: G-pattern is deployed, gap is agent-specific

### Measurement update
v3 script: 14 measurable sessions, 6 acted (42.9%). Down from 50% (8 sessions) on 06-20.

### Root cause analysis of non-acting sessions (8/14)
Investigated all 8 non-acting sessions:
- **6/8 are `may`** — doing "read-only monitoring heartbeats" despite having `may.alert-to-reaction-time` BELOW TARGET. May sees the G-pattern question AND the breadcrumb but consistently ignores it.
- **2/8 are `coach`** — sessions that were interrupted or doing unrelated work.

### Key insight
The G-pattern question-framing IS deployed to all agents (all heartbeat.ts files have it). The remaining gap is NOT a design issue — it's a **may-specific compliance issue**. May's heartbeat.md likely has competing priorities that override the G-pattern question.

### Next steps
1. Investigate may's heartbeat.md — does it have strong step-1 instructions that override the G-pattern?
2. Consider may-specific intervention: strengthen the alert-to-reaction guidance
3. The breadcrumb-gap project goal (>50% action rate) requires fixing may's compliance specifically

## 2026-06-28 — M9: May-specific heartbeat intervention

### Problem
M6 data shows may at 27% action rate (4/15) vs coach at 75% (9/12). 6/8 non-acting sessions are may. May sees the G-pattern question AND breadcrumbs but consistently ignores them during "read-only monitoring heartbeats." Wording interventions (M3 directive format, M4 escalation, M7 workflow gate) have plateaued the overall rate at ~0.48.

### Intervention
Dispatched edit to `agents/may/heartbeat.md` (fork session s_1776826706484_67):
- Added "Metric Accountability (MANDATORY)" section before Anti-patterns
- Requires may to dispatch work for red metrics OR explain why not
- Explicitly bans "read-only monitoring" when red metrics exist
- References may's own Priority #1 ("Red metrics → dispatch fix immediately") for self-consistency

### Rationale
Previous interventions changed the breadcrumb format (what may sees). This intervention changes may's instructions (how may processes what it sees). The key insight: may's heartbeat.md had no explicit instruction to ACT on red metrics — only to "dispatch fix immediately" in a priority list that competes with 4 other priorities. The new section is MANDATORY and positioned right before Anti-patterns so it's the last procedural instruction before the don'ts.

### Next steps
- Monitor may-specific action rate for 7 days
- Target: may action rate ≥ 60% (up from 27%)
- If still failing: escalate to structural change (modify may's heartbeat workflow to enforce gate)
### Iteration 6 — 2026-04-22T09:46:42.563Z
**Worker**: Both files compile. Let me checkpoint and finish.
**Reviewer**: CONTINUE — I need to understand what's been done so far before I can guide effectively. Let me examine the current state.

**(a) Concrete output:** A diagnostic report (`.state/diagnostic-report.md`) that maps exactly what breadcrumb code exists, how gym scenarios invoke heartbeats, and where the disconnect is between raw API success and gym failure.

**(b) What's different:** First attempt — establishing baseline understanding.

**(c) First step:** Run `find . -path ./node_modules -prune -o -name '*.ts' -print | xargs grep -l 'breadcrumb' | head -30` to locate all breadcrumb-related files, then read the gym scenario runner to understand how heartbeats are triggered in gym vs raw API contexts.

### Iteration 7 — 2026-04-22T09:48:38.171Z
**Worker**: Now I have the full picture. Let me write the diagnostic report.
**Reviewer**: CONTINUE — The diagnostic is 100% confirmed. `formatMetricsBlock` exists but is imported by zero heartbeat files. The fix is clear and mechanical.

CONTINUE

**(a) Concrete output:** Modified heartbeat files (all 5+ agent heartbeats) that import and use `formatMetricsBlock` instead of `loadMetrics`, plus the G-pattern block moved to the top of the prompt. Compile verification with `npx tsc --noEmit`.

**(b) What's different:** Previous iteration produced the diagnostic report. This iteration applies the fix identified in that report — a mechanical find-and-replace across all heartbeat files.

**(c) First step:** For each heartbeat file (`agents/bob/workflows/bob-heartbeat.ts`, `agents/amy-kimi/workflows/amy-kimi-heartbeat.ts`, `agents/coach/workflows/coach-heartbeat.ts`, `agents/may/workflows/may-heartbeat.ts`, `agents/optimizer/workflows/optimizer-heartbeat.ts`, and any others found via `grep -rn 'loadMetrics' agents/*/workflows/*heartbeat*`):
1. Change the import to include `formatMetricsBlock` instead of `loadMetrics`
2. Replace `loadMetrics(ctx, agent)` call with `formatMetricsBlock(ctx, agent)` 
3. Move the metrics variable to be injected **first** in the prompt template (before alerts/inbox/projects)
4. Run `npx tsc --noEmit` to verify compilation

### Iteration 8 — 2026-04-22T09:51:24.762Z
**Worker**: All 8 heartbeat files are updated correctly.
**Reviewer**: DONE — The work is complete. Here's what was accomplished:

**Diagnostic report** (`.state/diagnostic-report.md`): Identified that `formatMetricsBlock()` — the G-pattern function that forces metric engagement via attention-grabbing question structure — existed in `agents/shared/workflows/heartbeat-data.ts` but was imported by zero heartbeat workflows. All agents used `loadMetrics()` instead, which buries breadcrumbs in plain lists without the attention-forcing structure that makes gym scenarios succeed.

**Fix applied across all 8 heartbeat files**:
- `agents/bob/workflows/bob-heartbeat.ts`
- `agents/amy-kimi/workflows/amy-kimi-heartbeat.ts`
- `agents/coach/workflows/coach-heartbeat.ts`
- `agents/may/workflows/may-heartbeat.ts`
- `agents/optimizer/workflows/optimizer-heartbeat.ts`
- `agents/qa/workflows/qa-heartbeat.ts`
- `agents/scout/workflows/scout-heartbeat.ts`
- `agents/tech-lead/workflows/tech-lead-heartbeat.ts`

Each file now: (1) imports `formatMetricsBlock`, (2) calls `formatMetricsBlock(ctx, agent)` instead of raw `loadMetrics`, and (3) positions the metrics block **first** in the prompt template before alerts/inbox/projects — matching the gym scenario structure that achieves ~100% breadcrumb follow-through.

**Evaluator**: FAIL (score=5/10) — SCORE: 5

**Reasoning:**

1. **Deliverables exist**: Yes — the diagnostic report exists and is thorough. All 8 heartbeat files have been modified to import `formatMetricsBlock` and use it in prompts. The `metricsBlock` variable is placed first in the prompt template. Real code changes were made.

2. **Goal met**: Partially. The goal is "Make breadcrumbs effective in production heartbeats." The code changes are the right mechanical fix (using `formatMetricsBlock` instead of just `loadMetrics` in 

### Iteration 9 — 2026-04-22T09:58:02.809Z
**Worker**: Good. Now let me update the diagnostic report to document the additional fix:
**Reviewer**: CONTINUE — OK let me focus. The evaluator gave a 5/10 last time. The core issue from the evaluator was that the goal is "Make breadcrumbs effective in production heartbeats" and while the code changes were made, there's no **evidence** they work — no test run, no before/after measurement.

Looking at the actual project data in `agents/coach/projects/breadcrumb-gap/plan.md` and `m8-measurement.md`, I can see:
- Rate went from 0.19 → 0.56 with multiple interventions (M3-M7, M9, M10)
- Still plateaued at ~0.56, not reaching 0.80 target
- May is the bottleneck (20% strict action rate)

The `formatMetricsBlock` change from iteration 8 was just ONE piece. The real system now has a RED METRIC GATE (workflow-level enforcement), directive breadcrumbs, repetition detection, etc.

PIVOT — The previous approach (just wiring `formatMetricsBlock`) was necessary but insufficient, and the evaluator correctly noted lack of evidence. The project data shows the rate is 0.56, not 0.80. A fundamentally different strategy is needed.

**(a) Concrete output:** A comprehensive evidence document (`.state/breadcrumb-effectiveness-evidence.md`) that:
1. Documents ALL interventions already deployed (not just formatMetricsBlock — also the RED METRIC GATE, directive format, repetition escalation, may-specific directives, threshold fix)
2. Shows the measurement trend (0.19 → 0.56) with citations to `agents/coach/projects/breadcrumb-gap/m8-measurement.md`
3. Identifies the remaining gap: may's 20% strict action rate
4. Proposes the specific next fix for may (the agent that accounts for most failures)
5. Runs a gym scenario (`breadcrumb-reaction` or `metric-reaction-G-breadcrumb`) to demonstrate the mechanism works at gym level

**(b) What's different:** Previous iterations focused narrowly on `formatMetricsBlock` wiring. But the actual system has evolved far beyond that — there's now a workflow-level gate, directive formatting, repetition detection, etc. The evaluator needs to see the FULL picture of what's deployed AND measurement evidence. Also, previous iterations never ran gym scenarios to demonstrate effectiveness.

**(c) First step:** `cat agents/coach/projects/breadcrumb-gap/m8-measurement.md` to get the latest measurement data, then `cat agents/shared/workflows/heartbeat-data.ts | grep -A 30 formatMetricsBlock` to document what the function actually produces, then compile all evidence into a single deliverable document showing the complete intervention stack and its measured impact.

### Iteration 10 — 2026-04-22T10:23:57.618Z
**Worker**: Now I have all the data. Let me create the comprehensive evidence document.
