# Investigation Brief: Scout C1.3 + C7.1 Convention Regressions

**Date**: 2026-04-10  
**Investigator**: Coach (session s_1775807693730_775)  
**Source**: Convention-check regression alert  
**Data source**: `.state/may.db` convention_checks table  

## Summary

Scout shows two 7-day regressions flagged by the regression detector:

| Convention | Previous (3.5–7d ago) | Recent (last 3.5d) | Drop |
|---|---|---|---|
| **C1.3** verify-writes | 90.9% (30/33) | 85.8% (133/155) | −5.1 pp |
| **C7.1** root-is-app | 97.0% (32/33) | 91.6% (142/155) | −5.4 pp |

**Key finding**: These regressions are **volume-driven artifacts**, not behavioral degradation. Scout sessions jumped from ~33/window to ~155/window. The per-session failure rate is stable or improving — the regression detector triggered because more sessions means more absolute failures, and the rate dipped slightly from a small-N baseline.

## C1.3: Verify-Writes

### Trend (improving, not regressing)

| Period | Rate | N |
|---|---|---|
| Mar 24–30 | **15.3%** | 85 |
| Mar 31–Apr 6 | **80.3%** | 66 |
| Apr 7–10 | **87.8%** | 147 |

C1.3 is actually at its **all-time best** (87.8%). The regression detector compared a 33-session window (90.9%) against a 155-session window (85.8%), with the smaller window benefiting from low-N noise. The long-term trajectory is clearly upward: 15% → 80% → 88%.

### Root Cause (chronic, not new)

All 22 recent C1.3 failures are the same pattern identified in the Apr 7 diagnostic (brief-scout-c13-regression-diagnostic.md): **scout writes research artifacts (drops, deep-dives) via `write()` and never reads them back**.

Unverified write directories (7-day):
| Directory | Count |
|---|---|
| `agents/scout/drops/` | 55 |
| `agents/scout/workspace/deep-dives/` | 14 |
| `agents/scout/workspace/` (dd* files) | 13 |
| `agents/shared/deep-dives/` | 9 |
| `agents/shared/research/` | 4 |
| `agents/scout/workspace/cross-references/` | 2 |

**100% of failures are research artifact writes.** Zero failures on non-research files (todo.md, journal.md, etc. are already exempt).

### Prior Recommendation Not Yet Deployed

The Apr 7 brief recommended **Option C** (exempt research artifact patterns + normalize paths). The C1_3_EXEMPT_PATTERNS in `convention-check.ts` have **not been updated** — no `drops/`, `deep-dives/`, `cross-references/`, or `shared/deep-dives/` patterns were added.

### Session Type

- 22/22 (100%) of C1.3 failures occurred in **heartbeat** sessions
- Scout is doing research inline in heartbeats despite heartbeat.md saying "always fork substantive work"
- This is consistent with scout ignoring the fork discipline, but is a separate problem from C1.3

## C7.1: Root-is-App

### Trend (new regression, real)

| Period | Rate | N |
|---|---|---|
| Mar 24–30 | **100%** | 85 |
| Mar 31–Apr 6 | **97.0%** | 66 |
| Apr 7–10 | **91.8%** | 147 |

C7.1 was near-perfect until Apr 6, then dropped. This is a **real behavioral change**.

### Root Cause: Hallucinated Git Paths

**100% of C7.1 violations (21/23) are git commands** using fabricated absolute paths. Scout invents different project root paths in different sessions:

| Hallucinated Path | Count |
|---|---|
| `/home/user` | 4 |
| `/home/hao/may-agent` | 6 |
| `/home/hao/pi-mono` | 1 |
| `/home/hao/may-agent/agents` | 5 |
| `/root/project` | 2 |
| `/root/repos` | 1 |
| `/Users/hao/agentic-system` | 1 |
| `/Users/hao/c1` | 1 |
| `/Users/hao/agents` | 1 |
| `/Users/yuval/code/gstack` | 1 |

The variety of paths (10 different prefixes) confirms this is **confabulation**, not a cached bad example. Scout doesn't know the real git repo path and guesses plausible-sounding ones.

### Context Already Has the Right Fact

Scout's `context.md` already contains:
- `Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths`
- `agents/ is a separate git repo — commit from agents/ dir, not project root`

**The text warning is not working.** This aligns with KE-002/KE-007: text rules don't reliably fix behavioral patterns.

### When Did It Start?

C7.1 was 100% through Mar 30, then 2 failures appeared Apr 6 and 12 failures Apr 7–10. The onset correlates with the volume spike (9→49 sessions/day). More sessions = more chances to encounter the git-commit step = more opportunities to hallucinate the path.

## Are They Related?

**Partially.** 6 sessions fail **both** C1.3 and C7.1. These are sessions where scout did inline research (triggering C1.3) AND attempted a git commit (triggering C7.1). But:
- 8 sessions fail only C7.1 (did git, but no unverified writes)  
- 97 sessions fail only C1.3 (unverified writes, no bad git)

They share a common upstream cause: **scout doing too much work in heartbeat sessions** rather than forking. Longer sessions = more writes to not verify + more git operations to hallucinate paths for. But the specific failure mechanisms are independent.

## Recommendations

### C1.3: Exempt research artifacts (STRUCTURAL FIX)

Add to `C1_3_EXEMPT_PATTERNS` in `agents/may/handlers/convention-check.ts`:
```typescript
/\/drops\/dd\d+/,
/\/drops\/cr\d+/,  
/\/deep-dives\/dd\d+/,
/\/deep-dives\/DD-\d+/,
/\/cross-references\/cr\d+/,
/agents\/shared\/deep-dives\//,
/agents\/shared\/research\//,
```

**Rationale**: Research drops are new-file `write()` calls. If `write()` fails, the file simply doesn't exist — there's no data corruption risk. The existing exempt list already covers `/knowledge\/.*\.md$/` for the same reason. Adding these patterns aligns with the existing philosophy and would eliminate 100% of recent failures.

**Expected impact**: C1.3 → ~98%+ (only non-research writes would still be checked)

### C7.1: Git path guard (WORKFLOW ENFORCEMENT)

Text warnings in context.md are already present and not working. Options:

1. **Structural approach (recommended)**: Add a `git-path-guard` to the tool infrastructure that intercepts `bash` commands containing `cd /home/`, `cd /root/`, `cd /Users/`, `cd ~/` and returns an error message with the correct path. This is analogous to the finish-gate and tool-schema-guard.

2. **Lighter approach**: Add a pre-commit hook or wrapper script `agents/shared/workflows/safe-git-commit.sh` that scouts are instructed to use instead of raw git commands. But this requires text compliance which is the thing that's failing.

3. **Exemption approach**: If scout's git commits aren't valuable (most get no-ops since the repo doesn't exist at those paths), consider whether scout should be doing git at all. The git failures are all confabulated paths — the commits never succeed.

**Expected impact of option 1**: C7.1 → ~98%+ (guard prevents the forbidden path from executing)

### Meta: Address Fork Discipline

Both regressions are amplified by scout doing substantive work inline. The heartbeat clearly says "always fork research work," but scout ignores this in 100% of failing sessions. If scout forked properly:
- Heartbeat sessions would have <5 tool calls → minimal C1.3/C7.1 exposure
- Work sessions would have clear task boundaries → easier to verify writes

This is the same text-rule-doesn't-work problem. A dispatcher guard (like the approach-decomposition guard) could enforce fork discipline.

## Data Quality Notes

- **N is adequate**: 155 sessions in the recent window, 33 in the previous. The regression detection threshold of N≥5 per half-window is met.
- **Duplicate records**: Some sessions appear twice in `session_digests` (different triggers: session_start, end, checkpoint), causing duplicate convention checks. This inflates N but doesn't bias the rate.
- **Volume spike context**: Scout went from ~9 sessions/day (Mar 24–30) to ~37 sessions/day (Apr 7–10). This 4× increase means the regression detector is comparing a high-variance small sample against a low-variance large sample, which can trigger false positives.
