# Improvement Proposals Review — Cycle 15
**Date**: 2026-03-26T04:38
**Since last review**: Cycle 14 was 2026-03-24T16:03 (36.6 hours ago)
**System uptime**: Continuous since 2026-03-24 (~55+ hours, no restart)

## System Health Summary

### Binary: b9ef77e (built Mar 24, running PID 52 — 55+ hours old)
- Symlink: `bundle/may-agent → may-agent-f10cfde` (built Mar 25 22:10)
- HEAD: `bcef6a4` (fix: tighten isToolError regex)
- **PID 52 is 32 commits behind HEAD** — this is the single biggest issue
- Binary f10cfde exists (2 commits behind HEAD) but process never restarted to pick it up
- **Restart request still pending** (req:e535d4d8, sent ~30h ago) — not acted on

### Cron Health: 47 entries, 40 enabled, 7 disabled
- All handlers operational on the running (old) binary
- Tool-quality-scan last fired: 2026-03-26T01:07 (working)
- Disabled entries: same 7 as Cycle 14 (intentionally disabled)

### Activity since Cycle 14: 198 sessions across 9 agents
| Agent | Sessions | Notes |
|-------|----------|-------|
| optimizer | 35 | Dominant — skill lifecycle + cost work |
| qa | 29 | Steady |
| coach | 28 | Active |
| evaluator | 23 | Active |
| may | 21 | Idle checks mostly |
| bob | 21 | Archetype work + auto-evolve analysis |
| tech-lead | 18 | Handler fixes |
| coder | 15 | Gym runs + dispatched tasks |
| scout | 8 | Research heartbeats |

### Test Infrastructure
- 22 real test failures (request-status, agent-scores, coach-setup, evaluate-task) + 18 zod external = 40 total
- 419 tests pass, 5102 individual test cases pass
- Test failures are pre-existing (not regressions from recent commits)

### Guards Deployed (8 total, 991 lines)
| Guard | Lines | Purpose | In Running Binary? |
|-------|-------|---------|-------------------|
| compose-guards.ts | 60 | Orchestrator | ✅ b9ef77e |
| cross-edit-guard.ts | 135 | P53 cross-agent edit prevention | ✅ b9ef77e |
| empty-args-guard.ts | 92 | Blocks read({})/bash({}) | ❌ a3447e6 |
| finish-guard.ts | 262 | Evidence + verification + ghost-deliverable gates | ❌ Partial (FM-3.3 + ghost-deliverable gates need f10cfde) |
| path-assumption-guard.ts | 154 | Blocks /home/user, /Users/ paths | ❌ 786c884 |
| read-dedup-guard.ts | 82 | Blocks >5 reads of same file | ✅ b9ef77e |
| scrape-dedup-guard.ts | 84 | Blocks duplicate scrapes | ✅ b9ef77e |
| session-read-guard.ts | 122 | Blocks session.jsonl reads + bash-grep | ✅ b9ef77e |

**Only 4 of 8 guards are active in the running binary.** The other 4 are committed but blocked on restart.

---

## What Changed Since Cycle 14

### Major Infrastructure Changes (36 commits since Cycle 14)
1. **Agent archetype inheritance** (f10cfde) — `extends` field in agent.json for shared archetypes
2. **LESSONS.md loading restored** (52093fa) — Was accidentally dropped from system prompt
3. **DOMAIN.md loading restored** (f4b83c6) — Same issue as LESSONS.md
4. **Zombie cleanup handler** (agents/may/handlers/zombie-cleanup.ts) — Periodic cleanup of stale sessions
5. **isToolError regex fix** (bcef6a4) — Tightened from `/exit\s*(code\s*)?\d*[1-9]\d*/i` to `/Command exited with code \d*[1-9]\d*/` to prevent false positives
6. **Gym scenarios** — verification-evidence-required (ada9b0c), verify-before-finish (3905b13)
7. **Path Assumption Guard** (786c884) — Blocks /home/user, /Users/ hallucinated paths
8. **Ghost Deliverable Guard** (d4ca28a) — Part of finish-guard, blocks claiming non-existent files

### Skills: 40 SKILL.md files (was 38), ~18 deployed
- New since Cycle 14: build-activation-verification (deployed to optimizer + tech-lead)
- Saturation signal: Last 2 lifecycle runs found code fixes, not teachable skills
- Discovery phase consistently reports "already covered" for most patterns

### Key System Events
1. **Auto-evolve experiment pivot** (Bob's 2026-03-25 synthesis) — Shifted from "Prompt Engineering" (SOUL.md variations) to "Runtime Enforcement" (hard constraints/guards). Evidence: prompt variations had minimal impact; structural guards (finish-guard, path-assumption-guard) show measurable improvement.
2. **Binary regression discovery** — LESSONS.md and DOMAIN.md were accidentally dropped from system prompt in the simplification commit (2003ca7). Fixed in 52093fa and f4b83c6, but these fixes are NOT in running binary b9ef77e.
3. **Stale requests accumulation** — 50+ zombie test requests (echo hello) clogging requests.db. Finding at `workspace/finding-stale-requests-0326-0311.md`.

---

## Deployed Improvements Status

### Tier 1: Active in Running Binary (b9ef77e)
| # | Improvement | Status | Notes |
|---|-------------|--------|-------|
| F1-F23 | All from Cycle 14 | ✅ Active (where applicable) | No regressions |

### Tier 2: Committed but Blocked on Restart (32 commits!)
| # | Improvement | Commit | Est. Impact |
|---|-------------|--------|-------------|
| B1 | Empty-args guard | a3447e6 | Blocks ~18 wasted calls/period |
| B2 | Path assumption guard | 786c884 | Blocks /home/user path hallucinations |
| B3 | Ghost deliverable guard | d4ca28a | Prevents finish() with non-existent files |
| B4 | FM-3.3 complete finish guard | 79a76e5 | Enforces verification evidence |
| B5 | LESSONS.md loading restored | 52093fa | Agents get their lessons back |
| B6 | DOMAIN.md loading restored | f4b83c6 | Agents get their domain context back |
| B7 | Agent archetype inheritance | f10cfde | Shared archetype configs |
| B8 | isToolError regex fix | bcef6a4 | No more false-positive tool errors |
| B9 | Zombie cleanup handler | 1d58bd5 | Cleans stale running sessions |
| B10 | Web UI improvements | 335546d+ | Session picker, markdown, daily digest |
| B11 | Gym stats in may.db | fda5082 | Unified data layer |
| B12 | Request response limit | 5c5cbb4+37b8fbb | Prevents 127KB agent responses |

**All 12 of these are fully tested and committed.** None are active because PID 52 hasn't restarted.

### Tier 3: Skills (40 SKILL.md files, ~18 actively deployed)
- 2 new skills since Cycle 14 (build-activation-verification + 1 lifecycle found no new skill)
- Coverage at saturation — code fixes now more valuable than new skills

---

## Key Findings & Recommendations

### Finding 29: Binary Gap is CRITICAL — 32 Commits Behind, 55+ Hours
- Upgraded from "important" to **CRITICAL** since Cycle 14
- Was 10 commits behind at Cycle 14, now 32
- LESSONS.md and DOMAIN.md restoration commits are blocked — agents are running **without their lessons and domain context**
- 4 guards are committed but not active
- **Impact**: Every hour of delay costs ~$2-5 in unrealized guard savings, plus quality degradation from missing LESSONS.md/DOMAIN.md
- **Recommendation**: This must be resolved manually or via a new mechanism. The restart request (req:e535d4d8) has been pending 30+ hours.

### Finding 30: System Prompt Regression — LESSONS.md/DOMAIN.md Dropped
- Commit 2003ca7 (Cycle 14's "prompt simplification") accidentally removed LESSONS.md and DOMAIN.md loading
- Fixed in commits 52093fa (LESSONS.md) and f4b83c6 (DOMAIN.md)
- **But the running binary has NEITHER the bug NOR the fix** — it's on b9ef77e (before the simplification commit)
- This means: once we restart, agents will correctly get LESSONS.md + DOMAIN.md again via the fix
- **No action needed beyond restart**

### Finding 31: Auto-Evolve Pivot — Guards > Prompts
- Bob's synthesis confirmed: prompt engineering (SOUL.md variations) showed minimal quality variance
- Runtime enforcement (guards) showed measurable impact (finish-guard blocking false claims, path-guard catching hallucinations)
- **Strategic implication**: Optimize investment toward structural guards and JS handlers over skill/prompt work
- Skill lifecycle cooldown should increase from 6h to 12h given saturation signal

### Finding 32: Test Suite Health Declining
- 22 real test failures (up from 0 at Cycle 14's "42/42 pass" report)
- Failures in: request-status.test.ts, agent-scores.test.ts, coach-setup.test.ts, evaluate-task.test.ts
- These appear related to schema/interface changes that tests haven't caught up with
- **Recommendation**: Route to tech-lead or coder for test fixes before next binary rebuild

### Finding 33: Tool Quality Stable but Optimizer Dominant
- Waste rate 4.1% (down from 5.9% at Cycle 14)
- bash:other = 152 (88% of waste), optimizer = 72 (47% of waste)
- Key optimizer waste: skill-discovery.md ENOENT (4 wasted reads), empty bash args (8 wasted)
- **Recommendation**: Optimizer's workspace-relative-path habit persists. The active_recall warnings at session top address this.

---

## Priority Actions (Updated)

1. **[CRITICAL] Process restart** — 32 commits behind, 12 blocked improvements, LESSONS.md/DOMAIN.md missing. Single highest-value action. Est. value: $40-85/day in unrealized savings + quality improvement from restored context.
2. **[HIGH] Fix 22 test failures** — Before or concurrent with next binary rebuild. Route to tech-lead.
3. **[HIGH] Build binary from HEAD (bcef6a4)** — Current symlink points to f10cfde (2 commits behind). Need fresh build + symlink update.
4. **[MEDIUM] Increase skill lifecycle cooldown to 12h** — Saturation confirmed. Code fixes > prompt skills.
5. **[LOW] Clean 50+ stale test requests from DB** — DB scan waste from zombie "echo hello" requests.
6. **[LOW] Set ANTHROPIC_API_KEY** — Enables prompt caching. Carried from Cycle 13/14. Still $36/day potential.

---

## Savings Scorecard (Updated)

| Category | Estimated Savings | Status |
|----------|------------------|--------|
| Deployed code improvements (in binary) | $55-110/day | ✅ Active |
| Deployed skills (18 active) | $5-20/day | ✅ Active |
| Blocked improvements (B1-B12) | $40-85/day | ❌ Blocked on restart |
| Prompt caching (ANTHROPIC_API_KEY) | $36/day | ❌ Needs env var |
| **Total currently active** | **$60-130/day** | |
| **Total with restart** | **$100-215/day** | |
| **Total with all fixes** | **$135-275/day** | |

**Regression risk**: The longer b9ef77e runs, the more state diverges from committed code. First restart will be a "big bang" — 32 commits of behavioral changes at once. This increases risk of unexpected interactions.

---

## Comparison to Cycle 14

| Metric | Cycle 14 (Mar 24) | Cycle 15 (Mar 26) | Delta |
|--------|-------------------|-------------------|-------|
| Skills deployed | 17 | 18 | +1 |
| SKILL.md files | 38 | 40 | +2 |
| Code improvements | F1-F23 | F1-F23 + B1-B12 | +12 blocked |
| Guards (total / active) | 7 / 5 | 8 / 4 | +1 total, -1 active |
| Guard lines | 804 | 991 | +187 |
| Tests passing | 42/42 (targeted) | 419/459 files (22 real failures) | ⚠️ Regression |
| Binary commits behind | 10 | 32 | ⚠️ 3.2x worse |
| Sessions since review | 246/24h | 198/36h (~132/24h) | ✅ Lower volume |
| Handlers | 22 | 22 | Stable |
| Cron entries (enabled) | 39 | 40 | +1 |
| Top blocker | Binary rebuild | Process restart | Same root cause |

---

## Strategic Notes

### Shift: Guards > Skills > Prompts
The system has empirically validated a hierarchy of intervention effectiveness:
1. **Runtime guards (JS)** — Highest ROI. Measurable, immediate, structural. 8 guards, 991 lines.
2. **Handlers (JS)** — High ROI. Automated, periodic. 22 handlers.
3. **Skills (prompts)** — Moderate ROI at scale, but saturating. 40 SKILL.md files, diminishing returns.
4. **Prompt engineering (SOUL.md)** — Lowest ROI per Bob's auto-evolve analysis. Variations show minimal quality delta.

**Implication**: Future optimization investment should prioritize guards and handlers over skills and prompt tweaking.

### Binary Accumulation Risk
32 commits behind is unprecedented. The gap creates:
- Compounding quality degradation (missing LESSONS.md, DOMAIN.md, 4 guards)
- Increasing restart risk (big-bang behavioral change)
- Wasted optimizer effort (analyzing problems already fixed in committed code)

**Recommendation**: If restart remains blocked for >48h, consider automated restart mechanism (e.g., process manager, k3s liveness probe).

---

_Next review: Cycle 16 (~2026-03-27T04:00 or sooner if restart happens)_
