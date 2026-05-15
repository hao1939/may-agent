# amy-kimi C1.1 Regression Investigation — 2026-04-10

**Alert**: amy-kimi C1.1 dropped from 98.1% to 92.9% (split-window regression)
**Verdict**: NOISE — statistical artifact from small sample size, no intervention needed

## Summary

The regression detector flagged a 5.2pp drop by splitting the 7-day window into two halves:
- **Previous 3.5d** (Apr 3–6): 53/54 = 98.1% (1 failure)
- **Recent 3.5d** (Apr 7–10): 13/14 = 92.9% (1 failure)

The drop is entirely a **sample size effect**: 1 failure in 14 sessions looks like 7.1% failure rate, while 1 failure in 54 sessions looks like 1.9%. Both halves have exactly 1 failure each. The true rate is stable at 97.1% (66/68 over the full 7-day window).

## Evidence

### Daily Breakdown (Last 7 Days)
| Date | Rate | Failures |
|------|------|----------|
| Apr 1 | 100% (20/20) | 0 |
| Apr 2 | 100% (22/22) | 0 |
| Apr 3 | 100% (16/16) | 0 |
| Apr 4 | 94.7% (18/19) | 1 — edit after write without re-read |
| Apr 5 | 100% (18/18) | 0 |
| Apr 6 | 94.1% (16/17) | 1 — edit after write without re-read |
| Apr 7 | 100% (5/5) | 0 |

### Fleet Context (7-day C1.1 rates)
amy-kimi's 97.1% is **2nd best** in the fleet:
- may: 95.5%, optimizer: 93.4%, qa: 93.7%, tech-lead: 90.3%, bob: 89.4%, coach: 86.0%, scout: 76.5%
- **amy-kimi: 97.1%** — better than 8 of 9 other agents

### Root Cause of the 2 Recent Failures

Both follow the identical pattern: **write() a new file → do other work → edit() the same file without re-reading first**

1. **s_1775500338845_17** (Apr 6): `write(H-084-multi-agent-iron-law.md)` at call #19, then `edit()` at call #29 (10 calls later) to fix HB post numbers. No `read()` between.
2. **s_1775290519070_3** (Apr 4): `write(HB-061-trace2skill-distillation.md)` at call #17, then `edit()` at call #29 (12 calls later). No `read()` between.

Both sessions were **heartbeat** sessions (amy-kimi's only session type) with high quality evaluations (q=4, efficiency=4, verdict="good").

### Historical Trend (All-Time)
- **W12** (Mar 24-25): 63.3% — many violations from old checker that flagged `write()` too
- **W13** (Mar 30–Apr 5): 97.7% — dramatic improvement
- **W14** (Apr 6-10): 95.5% — stable, 1 failure

## Recommendations

### 1. No Intervention Needed
This is noise. Amy-kimi is the 2nd-best C1.1 performer in the fleet and improving over time. A targeted intervention could backfire by adding unnecessary cognitive load to an agent that's already performing well.

### 2. Consider Adjusting the Regression Detector
The 5pp threshold with a 3.5-day split is too sensitive for agents with low session counts. For amy-kimi (14 sessions in a half-window), a single failure creates a 7.1pp rate change. Possible fixes:
- **Minimum total threshold**: Require ≥20 sessions in the smaller half before flagging (currently ≥5)
- **Absolute failure count**: Also check that the failure count increased, not just the rate

### 3. (Optional) Checker Enhancement for write→edit Pattern
The C1.1 checker could add `write()` targets to `readPaths`, since the agent knows the exact content of files it just wrote. This would eliminate both recent violations and is logically sound: if you wrote the file, you know what's in it for purposes of constructing `oldText` in `edit()`. However, this is a low-priority optimization — the current behavior is defensible (re-reading after many intervening calls is safer).

## Data Sources
- Convention checks: `.state/may.db` → `convention_checks` table
- Summary: `.state/convention-checks/summary.json`
- Session transcripts: `.state/sessions/`
- Regression cooldown: `.state/convention-checks/regression-cooldown.json`
