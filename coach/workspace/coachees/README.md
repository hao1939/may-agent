# Coachees — Graduation Tracking

Status and coaching history for every agent. Updated after each coaching session.

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

| Agent | Level | Status | Sessions | Pass Streak | Priority |
|-------|-------|--------|----------|-------------|----------|
| Coder | L2 | 🎓 **GRADUATED** | 5 | **3/3** ✅ | Periodic regression review |
| Scout | L2 | 🎓 **GRADUATED** | 3 | **3/3** ✅ | Periodic regression review |
| **May** | **L1→L2** | **4/4 on points, gate blocked** | **4** | **4/4** (points) | **Escalated to Hao** |
| QA | L2 | 🎓 **GRADUATED** | 5 | **4/4** ✅ | Periodic regression review |
| Bob | L2→L3 | Model-level limitation confirmed | 6 | 0/3 | Low (accept limitation) |
| Master | L2 | Active | 2 | 1/3 | Medium |
| Amy-Kimi | L1 | Active — 1/3 streak | 1 | 1/3 | Medium (pending kimi API fix) |
| Amy | L1 | Blocked (infra) | 2 | 0/3 | High (after infra fix) |
| Optimizer | L2 | Not started | 0 | 0/3 | Medium |
| Evaluator | L1 | Not started | 0 | 0/3 | Low |

**Levels last assessed:** 2026-03-06 — see `workspace/capability-level-assessment-2026-03-06.md`

**Next coaching priorities (ordered):**
1. **May** — 4/4 streak on points. Graduation blocked by `delegate` vs `subagents.run`. **Escalated to Hao**: is this a real constraint or a style preference? If relaxed → instant graduation.
2. ~~**QA**~~ — 🎓 **GRADUATED** (2026-03-10). Periodic regression review.
3. **Master** — 1/3 streak. Efficiency exercise (excessive exploration is main weakness). Not coached since 2026-03-04.
4. ~~**Coder**~~ — 🎓 **GRADUATED** (2026-03-24). Regression review ~2026-04-07.
5. ~~**Scout**~~ — 🎓 **GRADUATED** (2026-03-09). Regression review ~2026-04-07.
6. **Bob** — Model-level adversity limitation confirmed. Instructional corrections exhausted. Controlled performance excellent. Accept limitation.
7. **Amy-Kimi** — 1/3 streak (opus model). Blocked on KIMI_API_KEY refresh + Chrome CDP fix.
8. **Amy** — Blocked on infra; escalate Docker mount fix

---

Individual agent files are in this directory: `<agent>.md`
