# EvoSkill Refinement — 2026-03-17 00:16 UTC

## Evidence Scan
Analyzed 200 most recent evaluations (of 3,140 total in `.state/evaluations/`).

### Top Failure Modes by Agent (non-skipped evals, last 200)

| Agent | FM Code | Count | Description |
|-------|---------|-------|-------------|
| may | FM-2.2 | 13 | Step ordering / protocol violations (C40) |
| may | FM-2.6 | 12 | Reasoning-action mismatch |
| may | FM-2.5 | 11 | Wrong path / tool schema errors |
| may | FM-3.3 | 7 | Verification failures |
| may | FM-2.1 | 5 | Evidence gaps |
| evaluator | FM-3.3 | 4 | Verification failures |
| tech-lead | FM-3.3 | 3 | Verification failures |
| tech-lead | FM-2.2 | 3 | Path mistakes |
| bob | FM-2.4 | 3 | Hallucination / insufficient verification |
| bob | FM-2.1 | 3 | Evidence gaps |
| amy | FM-2.6 | 3 | Reasoning-action mismatch |

**May accounts for 51/96 issues (53%)** — consistent with last cycle's finding.

## Root Cause Analysis: May's FM-2.5 (Wrong Path)

### Specific Pattern
7 of 11 FM-2.5 issues are: **`read("agents/may/todo.md")` instead of `read("agents/may/workspace/todo.md")`**

### Coaching Already Applied (Ineffective)
- SOUL.md line 5: `📂 YOUR FILES: Your todo is agents/may/workspace/todo.md — NOT agents/may/todo.md`
- LESSONS.md: `🔴 Correct TODO Path — agents/may/workspace/todo.md — NOT agents/may/todo.md. (14x recurrence)`
- Heartbeat.md: `read("agents/may/workspace/todo.md")` explicitly stated as first tool call

**14+ coaching interventions, still recurring.** This is a structural problem, not a coaching gap.

### Structural Fix Applied ✅
**Created symlink:** `agents/may/todo.md → workspace/todo.md`

When May reads the wrong path, it now silently resolves to the correct file. Eliminates the error category entirely without requiring behavioral change.

### Bonus: SIGNALS.md Root Symlink
Also created: `SIGNALS.md → agents/shared/SIGNALS.md` (agents sometimes read root path)

## Root Cause Analysis: May's FM-2.2 (Step Ordering)

### Specific Pattern
13 occurrences of heartbeat step-order violations:
- Not producing promise list before tool calls
- Batching SIGNALS/health checks before dispatching from todo
- Running system_status before Step 1 completion

### Assessment
Heartbeat.md already has explicit instructions ("🚨 STEP ORDER IS MANDATORY"). SOUL.md has C29 warning (18x violation). This appears to be an LLM behavioral tendency (parallel tool calling instinct) that coaching cannot fully fix.

**No skill evolution this cycle** — May's issues are (a) now structurally fixed (todo path), or (b) deeply ingrained LLM tendencies that coaching has exhausted its leverage on. The step-ordering issue may need a harness-level fix (e.g., intercepting first tool call batch and forcing single-call mode for May's first turn).

## Verification Skill Health Check
FM-3.3 (VERIFICATION_FAILURE/GAP) across all agents: 15 occurrences (down from 20 last cycle).
- Verification skill v1.1.0 may be contributing to improvement
- Still notable for evaluator (4) and tech-lead (3)
- No skill change warranted yet — trend is positive

## Actions Taken
1. ✅ Created `agents/may/todo.md` → `workspace/todo.md` symlink (structural fix for FM-2.5)
2. ✅ Created `SIGNALS.md` → `agents/shared/SIGNALS.md` symlink (bonus path fix)
3. ❌ No skill evolution — remaining issues are structural/LLM-behavioral, not skill gaps

---

## Update 2026-03-17 09:11 UTC

### Evidence Scan (40 recent evals)
- 8 actionable (non-skipped with issues)
- **VERIFICATION still #1**: 6 VERIFICATION + 4 FM-3.3 = 10 instances across 8 evals
- **Coder now biggest offender**: 13 issues (was May last cycle). May down to 3 issues.
- **New pattern: tech-lead SCOPE_DRIFT**: Assigned tool injection task, drifted to Phase-7 cleanup (2 duplicate sessions)

### Top Failure Patterns by FM Code
| Code | Count | Notes |
|------|-------|-------|
| VERIFICATION | 6 | All agents |
| FM-3.3 | 4 | Verification failures (coder 3, tech-lead 1) |
| FM-3.1 | 3 | Non-delivery (tech-lead 2, may 1) |
| TOOL_MISUSE | 2 | `bash({})`, `read({command:...})` (coder, may) |

### Issues by Agent
- **coder** (13): Edit fragility (FM-2.3, 2x), verification failures (FM-3.3, 3x), tool misuse (2x), spec noncompliance (2x), risky changes (1x), silent fail (1x), tooling contention (1x)
- **tech-lead** (9): Scope drift/non-delivery (4x), verification gaps (3x), unauthorized edits (1x), command errors (1x)
- **may** (3): Tool schema errors (1x), non-delivery (1x), dead-end non-recovery (1x)
- **optimizer** (2): Missing promise-deliver-report (1x), no read-back verification (1x)

### Skill Evolution Applied ✅
**file-safety/SKILL.md v1.1.0 → v1.2.0**: Added **AP-3: "Edit From Memory"**
- Addresses coder's edit fragility (FM-2.3, 2 occurrences)
- Pattern: `oldText` composed from memory instead of recent `read()` output → mismatch or ambiguous multi-match
- Fix: Read immediately before editing, copy exact text, include enough context for unique matching
- Evidence: s_1773731196068 (multi-match), s_1773726844123 (mismatched oldText)

### Notable Observations
1. **All agent skills lists are empty** — shared/skills/ has 20+ skills but no agent.json wires them. Skills are available via file reads but not injected into sessions. This may explain why skill improvements have limited impact.
2. **May's symlink fix appears effective** — down from 51 issues (53%) to 3 issues. FM-2.5 (wrong path) no longer appearing.
3. **Coder verification lesson exists but isn't preventing failures** — LESSONS.md has "FM-3.3 Verification Gate" but 3 new FM-3.3 occurrences anyway. May need structural enforcement (budget reservation).
4. **Tech-lead scope drift is new** — not in LESSONS.md. Two sessions both assigned "implement tool injection" both drifted to Phase-7 cleanup state inspection. Recommend adding scope-drift lesson.
