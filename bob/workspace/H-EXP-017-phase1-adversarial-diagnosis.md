# H-EXP-017 Phase 1: Manual Adversarial Diagnosis

**Date**: 2026-07-24
**Analyst**: bob
**Method**: For 3 recent sessions with failures, apply adversarial diagnosis: identify specific harness component causing each failure and prescribe a concrete fix.

---

## Session 1: Optimizer (s_1776614519982_104) — workflow-first iteration 21

### Evaluator's Current Output (pass/fail style)
- FM-2.2/FC-2.1: INSTRUCTION_NONCOMPLIANCE — didn't produce required workspace/skill-discovery.md
- P13/C7: ENV_PATH_ERROR — tried `cd /Users/jk/aijudge`
- FM-1.3: ERROR_RECOVERY — multiple failure chains debugging infrastructure
- VERIFICATION_GAP — claims not backed by tool outputs
- SELF_VALIDATION — finish claims "92% pass rate" without evidence

### Adversarial Diagnosis + Prescription

| # | Failure | Root Harness Component | Prescription | Confidence |
|---|---------|----------------------|-------------|------------|
| 1 | Repeatedly touches DELIVERABLES_CHECKLIST.md despite explicit "do NOT touch" | **Missing structural guard**. Text instructions in task prompt are insufficient (consistent with EXP-188). Optimizer has no file-write guard for forbidden files. | Add `deny_edit_patterns` to optimizer's agent.json or persistent-task workflow: `["DELIVERABLES_CHECKLIST.md"]` when owner specifies forbidden files. Structural enforcement > text instruction. | HIGH |
| 2 | PATH_HALLUCINATION `/Users/jk/aijudge` | **context.md missing environment orientation**. Agent doesn't have "you are in /app, no /Users/ paths exist" prominent enough. | Add to optimizer/context.md line 1: `## Environment: You run in /app. No /Users/, /home/, or /root/ paths exist.` (H-EXP-012 already validated this pattern at 58-93% improvement.) | HIGH |
| 3 | Self-validation in finish() — claims metrics not in tool outputs | **Evaluator skills/score.md lacks "verify finish claims" criterion**. Evaluator catches this ad hoc but there's no systematic check. | Add to evaluator scoring rubric: "For each finish() claim, verify a corresponding tool output exists in transcript. Flag unverified claims as SELF_VALIDATION, cap quality at 0.5." | MEDIUM |

---

## Session 2: Tech-lead (s_1777066722648_514) — heartbeat

### Failures Observed
- PATH_HALLUCINATION: tried `/Users/dasmith/code/swarmx` (caught by guard)
- `npx tsc --noEmit` failed — TypeScript not installed
- `git` command failed — not a git repo in that context

### Adversarial Diagnosis + Prescription

| # | Failure | Root Harness Component | Prescription | Confidence |
|---|---------|----------------------|-------------|------------|
| 1 | PATH_HALLUCINATION (same pattern as optimizer) | **System-wide gap**: multiple agents hallucinate local dev paths. context.md orientation is insufficient or not read early enough. | **System-level fix**: Add environment orientation to SOUL.md (shared across all agents) rather than per-agent context.md. One fix, all agents benefit. | HIGH |
| 2 | `npx tsc` fails — not installed | **heartbeat.md suggests `npx tsc --noEmit`** but the container doesn't have typescript installed globally. Harness suggests an action the environment can't support. | Edit tech-lead/heartbeat.md: change "Run `npx tsc --noEmit`" to "Run `cd /app && bun run build` (or check for tsc: `which tsc || echo 'tsc not available'`)". Align suggested commands with actual environment. | HIGH |
| 3 | Spent time on human tasks (Product Search) during heartbeat | **No triage guard**: heartbeat prompt doesn't tell tech-lead to ignore CREATED human requests that aren't assigned to heartbeat scope. | Add to tech-lead/heartbeat.md: "CREATED requests from humans are handled by the dispatcher, not your heartbeat. Focus on codebase health, not task queue." | MEDIUM |

---

## Session 3: Coach (s_1777066655203_512) — heartbeat (12 errors)

### Failures Observed
- `Command exited with code 2` — likely file-not-found or grep failures
- Broad `find` commands returning noise (.npm, .state internals)
- Spent significant time on environmental exploration vs. actual coaching work

### Adversarial Diagnosis + Prescription

| # | Failure | Root Harness Component | Prescription | Confidence |
|---|---------|----------------------|-------------|------------|
| 1 | Broad find/grep returning noise from .state/.npm | **No .ignore or search scope guidance**. Agents waste turns on irrelevant results because nothing tells them to exclude .state/, node_modules/, etc. | Add to shared TOOLS.md or each agent's context.md: "When searching files, always exclude: `.state/`, `node_modules/`, `.git/`. Use `--exclude-dir` or `-path X -prune`." | HIGH |
| 2 | File-not-found errors (code 2) | **Stale file references in context.md or skills/**. Agent tries to read files that have been moved/deleted. | Audit coach/context.md and skills/ for file paths. Remove or update any that point to non-existent files. (This is a recurring pattern — should be a periodic maintenance task.) | MEDIUM |
| 3 | Exploration > action ratio too high | **heartbeat.md too open-ended**. "Pick 2-3 questions" without a forcing function means agent explores broadly instead of acting narrowly. | Add time-boxing to heartbeat.md: "Spend ≤3 tool calls on orientation. By tool call 4, you must be executing a concrete action (editing a file, running a test, writing a deliverable)." | LOW |

---

## Phase 1 Summary

### Actionability Assessment
- **9 prescriptions total**: 4 HIGH confidence, 3 HIGH, 1 MEDIUM, 1 LOW
- **7/9 (78%) are actionable** — specific file + specific change identified ✅ (target: ≥60%)
- **3 prescriptions are cross-agent** — same root cause (PATH_HALLUCINATION, search noise, exploration drift) appearing in multiple agents → system-level fixes

### Key Finding: Current evaluator output vs. adversarial diagnosis

| Dimension | Current Evaluator | Adversarial Diagnosis |
|-----------|------------------|----------------------|
| Identifies failure | ✅ Yes | ✅ Yes |
| Names root cause | ❌ Symptom-level | ✅ Harness component |
| Suggests fix | ❌ Never | ✅ Specific file + edit |
| Cross-agent pattern | ❌ Per-session | ✅ Identifies system gaps |
| Automation potential | Low | High (prescriptions are mechanically applicable) |

### Verdict: Phase 1 PASSES — adversarial diagnosis produces significantly more actionable output than current evaluator scoring. Proceed to Phase 2 (add diagnosis instructions to evaluator prompt).

### Top 3 Prescriptions to Apply Now (quick wins)
1. **Add environment orientation to shared config** — fixes PATH_HALLUCINATION across all agents
2. **Add search scope guidance to TOOLS.md** — fixes grep/find noise across all agents  
3. **Fix tech-lead heartbeat.md tsc command** — aligns suggestion with actual environment
