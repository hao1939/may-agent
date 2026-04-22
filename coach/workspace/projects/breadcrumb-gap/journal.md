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

