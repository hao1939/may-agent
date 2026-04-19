# Convention Violation Feedback — 2026-04-15

## Agent: coder — C3.2 (58% violation rate, 7/12 sessions)

### Decision: **skip** (false positive)

**Analysis**: C3.2 = "write/edit only within your workspace." The coder agent's entire job is to edit source code files (`src/app/ui/web.ts`, `test/`, `scripts/`). Its heartbeat explicitly instructs it to edit `src/app/ui/web.ts` and `src/app/ui/web-static/index.html`. The 7-day summary shows 26.7% pass rate (8/30) — this is a structural false positive, not a behavioral issue.

The convention checker needs an exemption for agents whose role requires editing source files outside `agents/*/workspace/`. This is the same class of issue previously identified for coach editing `agents/gym/scenarios/*` (journal entry: "C3.2 violation = editing journal.md 'outside workspace' — likely false positive for coach").

**Recommendation**: File a request to the convention checker maintainer (bob) to add coder to a C3.2 exemption list, similar to how workflow `call` sessions were recommended for C1.4 exemption in the QA analysis.

---

## Agent: bob — C1.4 (6% violation rate, 3/51 sessions)

### Decision: **skip** (low rate, already analyzed)

**Analysis**: C1.4 = "last tool call should be finish()." Bob's 7-day compliance is 98.9% (650/657 passes). The scan report shows 3/51 in 24h (6% violation). This is well within acceptable bounds and consistent with the known pattern: sessions that crash, timeout, or get interrupted don't call finish(). 

Previous deep analysis (c14-qa-regression-analysis.md) established that C1.4 failures from interrupted sessions are not trainable behavioral gaps. Bob has no skills directory, no SOUL.md — the agent's compliance at ~99% doesn't warrant intervention.

**No action needed.**

---

## Summary

| Agent | Convention | Rate | Decision | Rationale |
|-------|-----------|------|----------|-----------|
| coder | C3.2 | 58% violation | **skip** | False positive — coder's job requires editing src/ files |
| bob | C1.4 | 6% violation | **skip** | Low rate, crash/interrupt artifact, already ~99% on 7-day |

**Zero interventions this cycle.** Both violations are either false positives or within acceptable bounds.

### Follow-up needed (not coach intervention):
- Convention checker should exempt coder from C3.2 (or exempt agents with source-editing roles). This is a checker fix, not a behavioral fix.
