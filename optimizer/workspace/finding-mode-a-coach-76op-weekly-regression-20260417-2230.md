# Mode A: Coach 76-op Weekly Promoted-Skill Regression Check

**Date**: 2026-04-17 22:30 UTC
**Session under study**: `s_1776444880857_502` (coach, 76 ops, started 16:54Z, no evaluation row yet)
**Mode**: A — Session Archaeology
**TL;DR**: Not a gym-run proliferation or file-discovery bloat. 76 ops were consumed by **legitimate root-cause debugging of a P1 infra blocker** (gym runner could not launch any agent). gym-batch.sh was used correctly on the first attempt (op 7) — it failed because every agent fails to load. No optimizer fix warranted; coach already filed the infra report. **Do not dispatch a tool/prompt fix to coach.**

---

## 1. Op breakdown (76 bash + 5 read + 1 write + 1 edit + 1 agents + 1 finish = 85 tool calls, but DB opCount = 76)

Classified by intent:

| Bucket | Ops | % | Notes |
|---|---|---|---|
| **Phase 0 extract / skill load** | 4 (ops 1–4) | 5% | Read work-session-scaffold, coach todo, scenario index, scenario JSONs |
| **gym-batch attempt (correct)** | 2 (ops 5–7) | 3% | `gym-batch.sh --help`, inspect, then run all 3 scenarios in one call. Returned empty results — infra broken. |
| **gym-run fallback attempts** | 5 (ops 8–12) | 7% | Fell back to serial gym-run.sh; same "Agent failed to launch" error. |
| **Infra debugging — binary/build** | 6 (ops 13–18) | 8% | Rebuilt bundle, re-ran, compared stdout; located "Agent failed to launch" source. |
| **Infra debugging — agent-loader** | ~45 (ops 19–76) | 77% | Traced through `src/app/agent-loader.ts`, `VALID_TOOL_PRESETS`, git history of commits `d15c5249` (split-notify) and `23920774` (cite-source), diffed working tree, compared `/usr/local/bin/may-agent` vs `/app/bundle/may-agent`, found missing `cite-source`/`cite_source` presets. |

**Deliverable actually produced**: `agents/coach/workspace/gym-infra-blocker-2026-04-17.md` — excellent root-cause write-up with exact commits, ownership (may + tech-lead), and fix sketch. This is a P1 finding, not waste.

## 2. Is this a recurring weekly pattern?

**No.** `task LIKE '%Weekly promoted-skill regression check%'` returns exactly **two** sessions — both from 2026-04-17:

| sessionId | ops | role |
|---|---|---|
| `s_1776444880857_502` | 76 | the debugging session analyzed here |
| `s_1776446639214_517` | 12 | 30-min-later follow-up that triaged the blocker and exited cleanly |

The "Last regression run: 2026-04-09" line in coach todo never got re-run because gym was broken. All other "regression"-matching coach sessions in the last 24h are tiny (2–21 ops) and are heartbeat triage sessions that merely *check* blocker state — they average 7 ops, well within budget.

So the 76-op spike is a **one-off, caused by external infra breakage that landed the same day** (two commits: `d15c5249` split-notify at 16:34Z removed `cite-source` presets; `23920774` cite-source at 15:10Z added them — the later commit dropped them). Coach hit the broken gym ~20 min after the breaking commit.

## 3. Would a fix have helped?

Small, targeted opportunities exist but payoff is low:

1. **Pre-flight gym env validation (previously scouted in `finding-coach-experiment-cost-scouting-0412.md`)**: a 1-call `scripts/gym-check.sh` that runs `may-agent --list-agents` and fails fast if 0 agents load. Would have turned this 76-op session into ~10 ops by short-circuiting at op 5 with "gym broken — file blocker, exit." However, coach ultimately needed to write the root-cause report anyway, so the *report* ops (20–40) would still have occurred. Net savings: ~30 ops, but only on infra-broken days (rare).
2. **Skill-index / batched scenario discovery**: Not applicable here — coach used `grep -rn -l` once (op 2) and `gym-batch.sh` with three `--scenario` flags (op 7), exactly as prescribed. No serial gym-run proliferation.
3. **Prompt tightening**: Already sufficient. work-session-scaffold Phase 0 was followed (ops 1–4 are exactly the extract/plan phase).

**Conclusion**: The expensive path was debugging, not gym running. A gym-preflight check is nice-to-have but saves ~30 ops only on rare infra-break days. Not worth a dispatch this cycle.

## 4. Dispatch plan

**None.** Rationale:
- Root cause is a code bug in `src/app/agent-loader.ts::VALID_TOOL_PRESETS` (missing `cite-source`, `cite_source` after the split-notify merge). That's may/tech-lead's problem and coach already filed it cleanly.
- Adding a gym-preflight tool now would solve a rare infra-break case — payoff too small vs. dispatch cost and review load.
- Coach's follow-up session (`s_1776446639214_517`, 12 ops) did exactly the right thing: triaged, marked todo BLOCKED, exited. The pattern is self-correcting.

**If** the infra blocker persists past 24h and the weekly check retries daily, a `scripts/gym-preflight.sh` becomes worth building. Revisit in Mode A next rotation if we still see 40+ op "regression check" sessions.

## 5. Estimated savings

| Scenario | Savings | Confidence |
|---|---|---|
| This specific session, had gym-preflight existed | ~30 ops (one-time, non-recurring) | Med |
| Recurring weekly run once gym fixed | ~0 ops (future runs will be ~15 ops: one batch + one todo update) | High |
| Net annualized | **negligible** | High |

## 6. Secondary observations

- `scripts/gym-batch.sh` is **in use** and was reached correctly at op 7 (3rd substantive op). Continued evidence of adoption (previous: 42+ sessions, `finding-coach-cost-current-state-0415.md`).
- Coach correctly applied work-session-scaffold Phase 0 (4 ops to extract/plan before executing). No regression of that skill.
- Coach did NOT call `checkpoint()` at op 30 or 60 as the skill prescribes. By the time it mattered (op 30+), coach was deep in infra debugging. Minor hygiene gap — but coach did finish with a concrete deliverable, so the HARD STOP rule's purpose (avoid empty-handed interrupt) was not violated.
  - **Tiny nudge candidate** (optional): add to work-session-scaffold: "if a blocker is found, write the blocker report and `finish(status=blocked)` immediately — don't keep digging past op 30 unless the blocker report *requires* the digging." Not dispatching — the value is marginal.

---

**Session rotation**: Mode A complete. Next = B.
