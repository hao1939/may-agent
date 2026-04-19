# Learning Loop Verification: Tech-Lead "cd" Rule

*Created: H636 (2026-03-15). Owner: Coach. Task: P2 Learning Loop verification from May.*

## 1. Which Lesson

**LESSONS.md Rule 1**: "NEVER use `cd` in bash commands (7x+ recurrence)"

> Your cwd is `/app`. It is ALWAYS `/app`. NEVER write `cd /anything && ...` in a bash command. Every single attempt fails. Just run commands directly: `npx vitest --run`, `npx tsc --noEmit`. Self-check: If your bash command starts with `cd`, DELETE the entire `cd ... &&` prefix.

This rule is also reinforced in **SOUL.md** with a prominent `## 🛑 CRITICAL` section.

**Why this lesson**: It's the most clearly measurable (grep for `"cd "` in bash commands), has the highest documented recurrence (7x+), and is reinforced in both LESSONS.md and SOUL.md — making it the strongest test of the learning loop.

## 2. Sessions Checked

I analyzed **134 tech-lead sessions** with bash commands across the full history, organized by time period:

| Period | Timestamp Range | Total Sessions (with bash) | Sessions with cd > 0 | Violation Rate |
|--------|----------------|---------------------------|----------------------|----------------|
| **Early** (s_17731*) | ~Mar 12 00:00–12:00 | 16 | 11 | **69%** |
| **Mid** (s_17733*) | ~Mar 13 00:00–24:00 | 36 | 4 | **11%** |
| **Late** (s_17734*) | ~Mar 14 00:00–24:00 | 42 | 4 | **10%** |
| **Recent** (s_17735*) | ~Mar 15 00:00–now | 40 | 4 | **10%** |

### Key Sessions Examined in Detail

**Recent violations** (to verify they're real regressions vs. benign):

| Session | cd count | bash count | cd rate |
|---------|----------|------------|---------|
| s_1773564688214_850 | 22 | 82 | 27% |
| s_1773497499476_0 | 24 | 300 | 8% |
| s_1773522019192_768 | 3 | 17 | 18% |
| s_1773546602838_323 | 2 | 44 | 5% |

**Two outlier long-running sessions** (in active/persistent sessions, not history):
| Session | cd count | bash count | Note |
|---------|----------|------------|------|
| s_1773410404965_0 | 136 | 272 | 50% rate — likely a long-running pre-lesson session |
| s_1773470593760_550 | 74 | 180 | 41% rate — same pattern |

**Recent clean sessions** (0 cd, confirming the lesson is working):
- s_1773580681127_81: 0/6 bash (recent, clean)
- s_1773576057544_1173: 0/20 bash (recent, clean, high bash count)
- s_1773566880787_918: 0/28 bash (recent, clean, high bash count)
- s_1773574131983_1118: 0/4 bash (recent, clean)
- s_1773581596369_106: 0/3 bash (most recent, clean)

## 3. Evidence of Behavior Change

### ✅ PARTIAL SUCCESS — Lesson Reduced Violations Significantly But Did Not Eliminate Them

**The good:**
- **Violation rate dropped from 69% → 10%** between early and recent periods. This is a 6.9x improvement.
- **Most recent 10 sessions**: Only 1 has any cd usage (s_1773575416625_1152 with 1/41 bash calls = 2.4%).
- The lesson is clearly being "read" by the model — it affects behavior in the majority of sessions.

**The bad:**
- **10% residual violation rate persists** — 4 out of 40 recent sessions still use `cd`.
- **Some violations are severe**: s_1773564688214_850 had 22 cd commands in 82 bash calls (27%). This isn't a minor slip — the agent reverted to pre-lesson behavior.
- **Long-running sessions are worse**: The two outlier active sessions (136/272 and 74/180) suggest that as context grows, the lesson gets diluted.

**The diagnosis:**
This is a **model-level attractor** (per P155 Learning Filter). The behavior pattern is:
1. Tech-lead reads LESSONS.md → sees "never cd" → follows rule ✅
2. After 100+ tool calls, lesson salience fades in context → old habit resurfaces ❌
3. Long complex tasks (300 bash calls) create higher reversion risk

This matches C17 (Model-Level Behavior): "Some behaviors are baked into the model and can't be fully eliminated by lessons or SOUL.md."

## 4. Conclusions

### Learning Loop Status: **PARTIALLY FUNCTIONAL**

| Dimension | Assessment |
|-----------|------------|
| Lesson → LESSONS.md | ✅ Present and well-structured |
| LESSONS.md → SOUL.md | ✅ Reinforced with 🛑 CRITICAL section |
| Agent reads lesson | ✅ Evidence: 90% compliance in recent sessions |
| Agent follows lesson | ⚠️ Partial: 90% compliance, but 10% regression with severe outliers |
| Persistent change | ❌ Not fully persistent: long sessions and complex tasks trigger reversion |

### Recommendations

1. **Accept 10% as model-level floor** — Per P155, this lesson is approaching the limit of what text-based learning can achieve. Further SOUL.md emphasis won't help.
2. **Infrastructure mitigation** — Consider a P53-style guard that warns when bash commands contain `cd /app`. This would catch the behavior at the tool level.
3. **Session-length awareness** — For tasks expected to be long (300+ bash calls), inject the lesson mid-session or break into shorter sub-sessions.
4. **Monitor, don't invest** — The 69%→10% drop is a major win. Chasing the last 10% has diminishing returns.

---

*Method: `grep -o '"command":"[^"]*cd [^"]*"' session.jsonl | wc -l` across 134 sessions. Tool calls counted via `grep -c '"bash"' session.jsonl`.*
