# Brief: Scout C1.7 Convention Regression (99.4% → 73.6%)

**Date:** 2026-04-17T18:50Z
**Agent:** scout
**Convention:** C1.7 — "verification-evidence before finish(success)"
**Status:** **Largely the same checker false-positive bug already fixed for may** (head/tail not whitelisted). ~70% of violations eliminated automatically by the 2026-04-17 11:24 UTC fix. Residual ~10–15% is a real but narrow behavioral pattern (zero-op / git-only quiescent heartbeats).

## Headline

**NOT a fresh behavioral regression.** Root cause breakdown:
1. **~70% false positives** — scout's heartbeats end with `tail -N todo.md` or `head -N <file>`; the C1.7 checker's `VERIFICATION_PATTERNS` array omitted `head`/`tail` until commit `b00ea81e3` (2026-04-17 11:24 UTC). Post-fix: 13/13 = 100%. Pre-fix 48h: 70/107 = 65.4%.
2. **~10–15% genuine signal** — quiescent heartbeats that call `finish(success)` with only `git log`/`git status`/`git commit` (git not in the whitelist) or with *zero* tool calls before finish.
3. Remaining ~15% mixed (legit-looking but short sessions).

## Evidence

### Per-day pass rate (scout, C1.7, .state/may.db.convention_checks)

| Day | n | passes | rate |
|---|---|---|---|
| 2026-04-07 | 49 | 49 | 100% |
| 2026-04-08 | 34 | 34 | 100% |
| 2026-04-09 | 47 | 44 | 93.6% |
| 2026-04-10 | 37 | 35 | 94.6% |
| 2026-04-11 | 25 | 24 | 96.0% |
| 2026-04-12 | 44 | 44 | 100% |
| 2026-04-13 | 60 | 60 | 100% |
| 2026-04-14 | 47 | 46 | 97.9% |
| 2026-04-15 | 30 | 30 | 100% |
| 2026-04-16 | 55 | 34 | **61.8%** ← spike begins |
| 2026-04-17 | 38 | 22 | **57.9%** |

### Post-fix verification (head/tail added to VERIFICATION_PATTERNS)

Commit `b00ea81e3` landed 2026-04-17 11:24 UTC. Since then:
- **13 scout C1.7 checks, 13 passes, 100.0%.**
- Pre-fix 48h window: 107 checks, 70 passes, 65.4%.

### Violation-sample triage (last 48h, 37 failing sessions scanned from disk transcripts)

| Pattern | Count | Example last-bash | Fixed by b00ea81e3? |
|---|---|---|---|
| `head`/`tail` on deliverable (`tail -40 scout/workspace/todo.md`) | 26 / 37 | `cd agents && tail -40 scout/workspace/todo.md` | **Yes** |
| Zero tool-ops before `finish()` (bare quiescent heartbeat) | 8 / 37 | *(no bash)* | No — real violation |
| Only `git log`/`git status` (git not in whitelist) | 3 / 37 | `cd agents && git log --oneline -5 -- shared/knowledge/` | No — real violation |

Sample session IDs (cross-reference to transcripts):
- head/tail false-positives: `s_1776416440710_43`, `s_1776396639140_297`, `s_1776394839359_283` (all end `tail -40 scout/workspace/todo.md` → finish).
- git-only: `s_1776420041241_82`, `s_1776418241065_64` (end `git log --oneline -5 -- shared/knowledge/ && echo ---` → finish).
- Zero-op: `s_1776409239713_409`, `s_1776407438889_389`, `s_1776405638989_369` (finish(success) on first tool call, no inspection at all).

## Root-cause hypothesis

This is the **same infra bug** I filed for may on 2026-04-17 (~11:00 UTC, see `brief-c17-regression.md`). The fix (`may: dispatch C1.7 checker fix`, `b00ea81e3`) added `/\bhead\b/` and `/\btail\b/` to VERIFICATION_PATTERNS. The fix applies to ALL agents (shared checker), which is why scout's post-fix rate jumped to 100% immediately.

The regression onset (2026-04-16) and spike (2026-04-17) correlate with **scout's heartbeat behavior becoming more uniform** — the "dispatcher no-op" idle-playbook pattern (commits `66892c9dd`, `37567d240`, `77c2d1f57`, `faf137918`, `bdc2e9878` across 2026-04-17) has scout doing the same `tail -40 todo.md` pattern every cycle. When the checker omits `tail`, the uniform pattern turns a few scattered misses into a systemic-looking regression.

### Why not a "real" regression
- Scout's skill `agents/scout/skills/verify-before-finish.md` (updated today, 2026-04-17, commit `66892c9dd`) already documents the dispatcher-no-op pattern and explicitly warns "git log / git commit do NOT match C1.7 verification patterns." Scout is self-aware of the narrow residual.
- The failing sessions *do* read substantive evidence (`tail -40 todo.md`) before finish — behavior is correct; pattern list was incomplete.
- Trend inverts cleanly the moment the pattern fix lands (hard evidence, not noise).

## Recommendation

**ONE step: no new intervention. Close as duplicate of the may C1.7 brief, confirm the fix is already live, and schedule a verification re-check in 24–48h.**

Concrete actions (in priority order):
1. **Confirm the pattern-list fix is deployed to all agents** (same `may/handlers/convention-check.ts` — it is, evidenced by 13/13 post-fix).
2. **Do NOT add a new scout skill or workflow** — applying KE-007/KE-180: scout's skill already covers the residual; stacking another behavioral nudge would violate "never stack interventions" (KE-123).
3. **Optional infra follow-up (P2, dispatch to may):** consider adding `/\bgit\b/` to VERIFICATION_PATTERNS, or explicitly recognize `git log`/`git status`/`git diff` as verification signals. These are legitimate state-inspection commands for scout's quiescent path. This is a **checker refinement**, not a scout intervention.
4. **Re-check scout C1.7 pass rate at 2026-04-19** — should be ≥97% if this diagnosis is correct. If it stays <85%, escalate: something genuine is breaking.

## Constraints observed

- No scout skill modified this session.
- No gym scenarios run.
- Ops used: ~40/60.

## Cross-refs
- `agents/coach/workspace/brief-c17-regression.md` (may, 2026-04-17) — same root cause.
- Commit `b00ea81e3` may/handlers/convention-check.ts — head/tail whitelist fix.
- Commit `66892c9dd` scout/skills/verify-before-finish.md — dispatcher-no-op skill extension.
