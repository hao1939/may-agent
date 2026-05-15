# M4 Audit: Coach Scaffold Compliance

**Date:** 2026-04-30  
**Auditor:** Worker agent  
**Scope:** Check whether recent coach work sessions follow the deployed scaffold (`agents/coach/skills/work-session-scaffold.md`)

## Scaffold Requirements (from `work-session-scaffold.md`)

The scaffold mandates three compliance markers for work sessions:
1. **TASK EXTRACT** block — with DELIVERABLE, METHOD, DONE-WHEN fields
2. **PLAN** block — numbered, ≤3 steps
3. **finish() with verification_evidence** — structural proof of completion

Applies to: sessions tagged `[WORK SESSION]` or multi-step objectives.  
Does NOT apply to: heartbeats, cron jobs, single-question dispatches.

---

## Evidence Sources

| Source | Found? | Notes |
|--------|--------|-------|
| `agents/coach/last-session.md` | ✅ | Session s_1777531551293_609, 1m6s, "daily digest already committed" — trivial session |
| `agents/coach/completion-report.md` | ✅ | Generic "DONE ✅" — no scaffold markers |
| Coach session transcript (s_1777529334804_578) | ✅ | Full transcript available via evaluator task tree eval |
| `.state/coach-heartbeat-log.md` | ✅ | Multiple heartbeat summaries — scaffold not applicable to heartbeats |
| `.state/sessions/history/` | ⚠️ | No coach-specific meta.json files found directly; coach sessions accessed via evaluator evals |

---

## Session-by-Session Analysis

### Session s_1777529334804_578 (Heartbeat, $0.346, 48 turns)

**Type:** Heartbeat (scaffold says "Do NOT apply to heartbeats")  
**However:** This session included multi-step experiment work (EXP-277 Phase 3, gym scenario fixes, npm debugging) — making it arguably a work session in practice.

**Scaffold compliance markers found:**
- `TASK EXTRACT`: ❌ **Not present** (0 occurrences in session.jsonl)
- `PLAN:` block: ❌ **Not present** (0 occurrences)
- `finish()` called: ✅ Yes
- `verification_evidence` in finish: ✅ Yes (3 items citing specific bash outputs)

**Quality outcome:** Evaluator noted 22 wasted calls from failure chains. The session spent 18 calls on an npm dependency rabbit hole that a proper PLAN phase might have scoped/bounded.

### Session s_1777531551293_609 (trivial, 1m6s)

**Type:** Trivial/single-action — scaffold not applicable.  
**Result:** "Daily digest already committed." No work done.

### Heartbeat Log Sessions (2026-08-01, 2027-08-03, etc.)

**Type:** Heartbeats — scaffold explicitly not applicable.  
**Observation:** These follow a consistent informal structure (Metrics → Notifications → Investigation → Action → Next priorities) but not the formal scaffold.

---

## Summary Findings

| Metric | Value |
|--------|-------|
| Total coach sessions accessible | 2 (1 substantive, 1 trivial) |
| Sessions where scaffold applies | 1 (s_1777529334804_578 — multi-step work within heartbeat) |
| TASK EXTRACT present | 0/1 (0%) |
| PLAN block present | 0/1 (0%) |
| finish() with verification | 1/1 (100%) |
| **Overall scaffold compliance** | **Partial (1/3 markers)** |

---

## Key Observations

1. **The scaffold is NOT being followed for the EXTRACT/PLAN phases.** The one substantive session dove straight into exploration (checking skills, experiments, requests) without writing a TASK EXTRACT or PLAN block first.

2. **finish() compliance is good.** The session did call finish() with structured verification_evidence (3 items citing specific tool outputs).

3. **The heartbeat exemption creates a loophole.** Coach heartbeats often contain substantial multi-step work (experiment management, gym scenario fixes) that the scaffold is designed to help with, but the "Do NOT apply to heartbeats" rule exempts them.

4. **Limited session data available.** Coach session transcripts are not stored in a standard searchable location. The only full transcript found was embedded in an evaluator task-tree evaluation.

---

## Recommendations

1. **Clarify scaffold applicability:** If a heartbeat includes >5 ops of multi-step work, the scaffold should apply to that work segment.

2. **Add compliance self-reporting:** Include a `scaffold_used: boolean` field in coach's finish() calls to enable automated tracking.

3. **Improve session accessibility:** Coach session transcripts should be stored in a consistent, searchable location (e.g., `.state/sessions/history/` with agent field in meta.json).

4. **Root cause of non-compliance:** The scaffold was designed for "work sessions" but the coach primarily operates via heartbeats that blur the line. The scaffold trigger condition needs updating.

---

## Measurement Limitations

- Only 1 substantive coach session transcript was accessible for audit
- Coach sessions lack `"agent":"coach"` in meta.json, making them hard to find programmatically  
- Heartbeat log entries are summaries, not full transcripts — cannot verify scaffold markers from summaries alone

**Confidence level:** Medium — findings are directionally correct but based on limited sample (n=1 full transcript).
