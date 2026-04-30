# Journal

## Iteration 1 — Phase 1: Mine Historical Conversations (2025-06-27)

**What**: Scanned all 67 chat sessions from `.state/sessions/` (both active and history). Extracted every `kind: "chat"` meta.json, sorted chronologically, and analyzed Hao's task content for directives, corrections, and preferences.

**Findings**:
- 18 explicit directives identified
- 5 corrections (times Hao said "no" or reversed a decision)
- Strongest signal: **stability-first** — Hao said "stop exploring, fix existing" at least 3 separate times
- Second strongest: **May must think before delegating** — don't forward blindly
- Third: **constraints must be real** — don't weaken guards

**Output**: `phase1-findings.md` — full analysis with tables, quotes, and recommendations

**Next**: Phase 2 — Build preferences.md as a living document, create decision scorecard

## Iteration 4 — 2026-04-29T19:00

**Phase 3 progress**: Integrated preference summary into `agents/may/context.md`. Key preferences (stability-first, guards-stay-strong, quality>quantity, observability, anti-patterns) now available to May every session without reading the full doc.

**Next**: Add same block to coach/bob/tech-lead/optimizer context files. Then measure: are we making fewer decisions Hao corrects?

### Iteration 1 — 2026-04-30T01:04:43.884Z
**⚠️ No output files produced (1 consecutive failures)**

### Iteration 1 — 2026-04-30T01:05:40.191Z
**Worker**: 

### Iteration 1 — 2026-04-30T01:11:45.527Z
**Worker**: No new session data accessible for scanning. I'll proceed to produce the preference-check gate deliverable.
**Orchestrator**: The file is in an ignored path so git doesn't track it. Working tree is clean.

### Iteration 2 — 2026-04-30T01:13:53.280Z
**Worker**: Now let me apply the gate to May's actual context.md:
**Orchestrator**: CONTINUE

(a) Phase 3 is nearly complete. The remaining item is **instrument correction tracking** — tag overrides/rejections in session metadata so we can measure correction rate over time automatically rather than manually scanning.

(b) I wrote the preference-check gate myself since the worker fa

### Iteration 3 — 2026-04-30T01:16:13.869Z
**Worker**: 

### Iteration 4 — 2026-04-30T01:17:49.571Z
**Worker**: The gate IS already in May's context.md. Now let me produce the correction-tracking deliverables from iteration 3's task (which was never completed):
