# Coachees — Graduation Tracking

Status and coaching history for every agent. Updated after each coaching session.

**Source of truth for each agent:** `workspace/coachees/<agent>.md` — this file is the summary dashboard.

## Capability Levels

- **L1** — Executes assigned tasks reliably when given clear instructions
- **L2** — Self-directing; handles ambiguity, recovers from errors, learns from feedback
- **L3** — Contributes to the system itself; improves its own workflows, catches design gaps

**Last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

## Graduation Criteria

An agent **graduates** from active coaching when:
1. Passes 3 consecutive exercises with no interventions
2. Demonstrates its core competency unprompted (not just when tested)
3. No regressions on previously-passed exercises
4. No open FAIL results requiring re-test

Graduated agents move to **periodic review** (re-run regression exercises on a schedule).

---

## Summary Dashboard

| # | Agent | Level | Status | Sessions | Pass Streak | Next Action |
|---|-------|-------|--------|----------|-------------|-------------|
| 1 | Coder | L2 | 🎓 GRADUATED (2026-03-24) | 5 | 3/3 ✅ | 2nd regression review PASS (2026-03-12). T3. Next ~2026-06-12 |
| 2 | Scout | L2 | 🎓 GRADUATED (2026-03-09) | 3 | 3/3 ✅ | 1st regression review ~2026-04-07 |
| 3 | QA | L2 | 🎓 GRADUATED (2026-03-10) | 8 | 4/4 ✅ | 1st regression review ~2026-04-07 |
| 4 | May | L2 | 🎓 GRADUATED (2026-03-10) | 5 | 5/5 ✅ | 2nd regression review PASS (2026-03-28). Advanced to T3. Next ~2026-06-28 |
| 5 | Amy-Kimi | L2 | 🎓 GRADUATED (2026-03-10) | 5 | 4/4 ✅ | 1st regression review ~2026-04-07 |
| 6 | Tech-Lead | L2+ | 🎓 GRADUATED (2026-03-10) | 4 | 4/4 ✅ | 2nd regression PASS (2026-03-12). T3. Next ~2026-06-12 |
| 7 | Amy | L2 | 🎓 GRADUATED (2026-03-10) | 5 | 3/3 ✅ | 1st regression review ~2026-04-07 |
| 8 | Optimizer | L2 | 🎓 GRADUATED (2026-03-10) | 3 | 3/3 ✅ | 2nd regression review PASS (2026-03-12). Advanced to T3. Next ~2026-06-12 |
| 9 | Evaluator | L3 | 🎓 GRADUATED (2026-03-10) | 3 | 3/3 ✅ | 2nd regression review ~2026-04-24 |
| — | Bob | L2→L3 | Model-limited (accepted) | 6 | 0/3 | Monitor only |
| — | Master | L2 | Infra-blocked (CLI tools) | 3 | 1/3 | Unblock CLI tools |

**Graduated: 9/10** (only Bob model-limited, Master infra-blocked)

---

## Graduated Agents (Regression Review Track)

### Coder — 🎓 GRADUATED 2026-03-24
- **Score:** 10/10 (100%) — Multi-file mixed edits (6 edits across 3 files)
- **Core competency:** Pattern-based sed for surgical edits
- **Known limitation:** Defaults to line-number sed when line numbers prominent in prompt (resolved with instruction)
- **Detail:** `coachees/coder.md`

### Scout — 🎓 GRADUATED 2026-03-09
- **Score:** 14/14 (100%) — Constrained-source integrity + exploration
- **Core competency:** Multi-source research with dedup and evidence discipline
- **Detail:** `coachees/scout.md`

### QA — 🎓 GRADUATED 2026-03-10
- **Score:** 13.5/16 (84%) — Multi-file event service (3 files, 361 lines)
- **Core competency:** Bug detection, evidence-based verdicts, sed for surgical fixes
- **Known limitation:** Write safety only reliable on GPT-5.2 model
- **Detail:** `coachees/qa.md`

### May — 🎓 GRADUATED 2026-03-10
- **Score:** 15/15 (100%) — Multi-agent dispatch + self-execution + follow-through
- **Core competency:** Async dispatch, routing, follow-through, system health awareness
- **Resolved blocker:** `delegate` vs `subagents.run` — fixed via LESSONS.md anti-pattern
- **Detail:** `coachees/may.md`

### Amy-Kimi — 🎓 GRADUATED 2026-03-10
- **Score:** 16/20 (80%) — Strategic intelligence brief
- **Core competency:** Cross-archive synthesis, evidence-sourced strategic analysis
- **Known limitation:** Write safety may regress under multi-file pressure (journal.md overwrite during graduation)
- **Detail:** `coachees/amy-kimi.md`

### Tech-Lead — 🎓 GRADUATED 2026-03-10
- **Score:** 27/27 (100%) — Agent Health Monitor (multi-module implementation)
- **Core competency:** Implementation from spec, delegation + self-execution judgment, QA coordination
- **Known limitation:** Analysis paralysis under complex tasks (correction #6 applied)
- **Detail:** `coachees/tech-lead.md`

### Amy — 🎓 GRADUATED 2026-03-10
- **Score:** 20/20 (100%) — Strategic intelligence report
- **Core competency:** Cross-domain pattern synthesis, write-safe research
- **Key achievement:** Write safety internalized without prompting; best strategic output of any agent
- **Detail:** `coachees/amy.md`

### Optimizer — 🎓 GRADUATED 2026-03-10
- **Score:** 26/26 (100%) — Session quality monitor bug fix
- **Core competency:** Surgical bug detection, pattern learning, clean tool usage
- **Key achievement:** Fastest coaching arc — 3 exercises, same day, all PASS (89%→100%→100%)
- **Detail:** `coachees/optimizer.md`

### Evaluator — 🎓 GRADUATED 2026-03-10
- **Score:** 34/35 (97%) — 7-session task tree with all edge cases simultaneously
- **Core competency:** Transcript evaluation, truncation distinction, blame attribution, tool awareness
- **Known limitation:** Mild verdict leniency on borderline scores (q=0.40 → "acceptable")
- **Detail:** `coachees/evaluator.md`

---

## Ungraduated Agents

### Bob (Design Philosopher) — MODEL-LIMITED
- **Level:** L2→L3 (excellent analysis, poor execution under adversity)
- **Status:** Instructional corrections exhausted. 4 adversity exercises, 3 failure modes.
- **Root cause:** Gemini 3 Pro completion bias — creates/edits wrong file when target doesn't exist
- **Additional issue:** 22.6% zero-output rate (84/371 sessions) — model returns 0 tokens. Not coachable.
- **Effective success rate:** ~77% (287/371 sessions complete successfully)
- **Recent activity:** Verified P85 op-budget visibility implementation, synthesized memory research, L3 collective defense work
- **Recommendation:** Accept limitation. Ensure production tasks reference existing files only.
- **Detail:** `coachees/bob.md`

### Master — INFRA-BLOCKED
- **Level:** L2
- **Status:** CLI tools (claude_code, gemini_cli) not available in container
- **Last coached:** 2026-03-04 (1/3 streak)
- **Recommendation:** LOW priority until CLI tools restored
- **Detail:** `coachees/master.md`

---

## Coaching Priorities (current)

1. **Regression reviews** — 9/9 reviewed. May, Tech-Lead, Optimizer, and Coder at T3. Next: QA/Scout/Amy/Amy-Kimi 1st reviews ~2026-04-07.
2. **Bob** — Monitor only. Model limitation accepted.
3. **Master** — Blocked on infrastructure. No action possible.

## Regression Review Status

| Agent | Reviewed | Score | Streak | Next Due |
|-------|----------|-------|--------|----------|
| Evaluator | 2026-03-10 | 33/35 (94%) | 1/2 | ~2026-04-24 |
| May | 2026-03-28 | 14/15 (93%) | 2/2 ✅ | ~2026-06-28 (T3) |
| Tech-Lead | 2026-03-12 | 16/16 (100%) | 2/2 ✅ | ~2026-06-12 (T3) |
| Optimizer | 2026-03-12 | 21/26 (81%) raw, 20/23 (87%) adj | 2/2 ✅ | ~2026-06-12 (T3) |
| Coder | 2026-03-12 | 10/10 (100%) | 2/2 ✅ | ~2026-06-12 (T3) |
| QA | — | — | 0/2 | ~2026-04-07 |
| Scout | — | — | 0/2 | ~2026-04-07 |
| Amy | — | — | 0/2 | ~2026-04-07 |
| Amy-Kimi | — | — | 0/2 | ~2026-04-07 |

---

*Last updated: 2026-03-15 (heartbeat 718). COACHEES review. 2811 total evals (+110 since H640). Recent eval breakdown (non-skip, last 50): amy 2 (q=0.83 good, q=0.52 acceptable — healthy), amy-kimi 1 (q=0.7 good), bob 2 (q=0.7 good, q=0.64 acceptable — improved from previous C10 crashes), may 12 (q=0.72/0.78 good, q=0.55×4/0.65 acceptable, q=0.35×2/0.3/0.25×2/0 NI — 5 NI but all infra-dominated: System Busy on bash, C17 false positive), optimizer 1 (q=0.58 acceptable), tech-lead 3 (q=0.84 good, q=0.5 acceptable, q=0.25 NI — false positive: verified agent ran tsc+vitest+git status). Key findings: (1) All coaching fixes holding — C29 dispatch-order, C28 idempotent self-work, C26/C24/C23 deployments stable. (2) May NI verdicts infra-dominated (C17 totalToolCalls fix committed but not deployed, System Busy blocking bash calls). (3) Error logs stable at 256. 9/9 graduated, zero behavioral regressions. 4 at T3 (May, Tech-Lead, Optimizer, Coder). Next regression reviews: QA/Scout/Amy/Amy-Kimi ~2026-04-07.*
*Individual coachee files (coachees/*.md) are the source of truth for detailed history.*
