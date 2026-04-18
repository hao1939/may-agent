# Mode A — Coach Convention-Regression Investigation Sessions (6h)

**Date:** 2026-04-18T00:30Z
**Mode:** A — Session Archaeology
**Scope:** Three coach sessions in the last ~6h that investigated convention regressions.

## Sessions under the microscope

| Session | Dur | opCount | Subject | Brief produced |
|---|---|---:|---|---|
| s_1776451760999_560 | 8m30s | 59 | scout C1.7 99.4→73.6% | `agents/coach/workspace/brief-scout-c17-regression.md` |
| s_1776453558249_577 | 7m35s | 41 | coach C1.1 92.5→87.1% | `agents/coach/workspace/brief-coach-c11-regression.md` |
| s_1776464362791_664 | 6m32s | 32 | may   C1.1 97→92% | `agents/coach/workspace/brief-may-c11-regression-apr17.md` |

Tool distributions (assistant tool-calls parsed from `session.jsonl`):
- 560: bash×63, read×5, write×1, finish×1
- 577: bash×44, read×1, write×2, finish×1
- 664: bash×34, read×2, write×1, finish×3 (three finish attempts — recovery on gitignore)

## (1) Was the op cost justified?

**Convergent answer: yes for findings, no for ops.** All three investigations arrived at the *same* root-cause class (checker-pattern false positive, not behavioral regression) with concrete, actionable evidence. But the cost was front-loaded on the earliest session and never amortized.

### Op-cost breakdown (what ate the budget)

**s_1776451760999_560 (scout C1.7 — 59 bash, the worst offender)**
- Ops 1–9 (setup/discovery): locate convention_checks table, find C1.7 definition — 9 ops. *Reasonable.*
- Ops 13–17 (pass-rate & violations): DB queries establishing the daily drop — 5 ops. *On-budget.*
- Ops 18–29 (session-log path flailing): `ls .state/instances`, `ls .state/logs/detached-*`, `find .state -name "*1776420041241*"`, multiple tail attempts, malformed JSON parse — **~12 ops of path-guessing waste**. Root cause: didn't know `.state/sessions/history/<id>/session.jsonl` is canonical.
- Ops 30–53 (git-archaeology for onset): `git log -- may/handlers/convention-check.ts` repeated 10+ times with varying date windows, pickaxe-regex for `VERIFICATION_PATTERNS`, `--follow`, `--diff-filter` — **~20 ops of hunt-the-commit**. Did eventually find commit `b00ea81e3` (head/tail whitelist fix) but overshot: once the commit was identified, kept digging.
- Ops 54–68 (writeup): extract representative sessions, draft brief — 14 ops. *Reasonable.*

**s_1776453558249_577 (coach C1.1 — 41 bash, moderate)**
- Ops 1–9: find convention_checks + C1.1 definition — path wasn't discovered cleanly (tried `agents/shared/conventions/`, then `agents/shared/knowledge/conventions/`, then grep-by-keyword) — *~3 ops wasted*.
- Ops 10–19: **grep spiral for checker source code** — 9 consecutive greps trying every phrase ("without prior read", "read_before_edit", `readBeforeEdit`, "prior read", `checkC1_1`) against `src/`, `scripts/`, `agents/shared/`. Eventually found it in `agents/may/handlers/convention-check.ts` at step 19. **~8 ops wasted**. This is information that session 560 already learned 30 minutes earlier.
- Ops 20–34: per-session tool-call classification via python3 one-liners, multiple heredoc iterations — 15 ops, productive but clunky.
- Ops 35–48: write brief + verify — 14 ops. *Reasonable.*

**s_1776464362791_664 (may C1.1 — 32 bash, leanest)**
- Ops 1–17: fully DB-driven — per-window rates, daily trend, task-class breakdown, offender pinpoint (`cron:project-resume`) — 17 ops. *Lean and surgical.*
- Ops 18–26: grep-spiral to locate the C1.1 checker definition (again!) — *~6 ops wasted; same bug as session 577, 3h later*.
- Ops 27–30: read + write brief — 4 ops.
- Ops 31–40: **gitignore recovery** — first `git add` failed because `coach/workspace/brief-*` is gitignored; session stashed/popped + committed `KE-213` instead, then re-finished. **~8 ops of infra friction**, unrelated to the investigation itself.

**Verdict:** The briefs are valuable (all 3 are well-structured, cite evidence, and converge on the same diagnosis). But roughly **40% of total ops (≈55 of ~132 bash calls) were path-discovery, checker-source hunting, or git-archaeology waste that repeats across sessions.** This is the canonical KE-140 duplicate-work pattern — three sessions re-learned the same file locations.

## (2) Is the pattern templatable?

**Yes.** All three sessions execute the same 5-phase recipe, with per-phase bloat that would drop dramatically with a template. Evidence: 3 sessions, same structure, same outputs.

### The invariant recipe

1. **Establish rate movement** — `SELECT passed/total FROM convention_checks WHERE agent=? AND convention=? GROUP BY date` over 7/14/30d windows. (DB-only, ≤3 ops.)
2. **Sample violations** — pull 3-5 failing sessionIds + the offending tool-call snippets. (DB-only, ≤2 ops.)
3. **Read the checker** — `agents/may/handlers/convention-check.ts`, find `checkC<N>_<K>_<name>` function. (1 `read`.)
4. **Classify failures** — bucket into: (a) literal violations, (b) checker-pattern gap (e.g. `bash cat` not counted as read, `head`/`tail` not in `VERIFICATION_PATTERNS`), (c) new handler class, (d) noise. (1 small analysis script, ≤3 ops.)
5. **Write brief + R1** — infra-ticket XOR behavioral-skill, never both (KE-123).

**Target budget: 12–15 ops.** Current avg: 44. Est. savings per investigation: **~30 ops ≈ $1.50**, and regressions fire 2-4×/week.

### Convergent root-cause class (all 3 sessions)

Every one concluded: **the checker false-positives on `bash cat/head/grep/jq/git` as the evidence/read channel.** Three independent discoveries of the same defect is not noise — it's a pending infra fix.

| Brief | Specific gap found |
|---|---|
| scout C1.7 | `head`/`tail` not in `VERIFICATION_PATTERNS` (partial fix `b00ea81e3`); `git log/status` also missing |
| coach C1.1 | `checkC1_1_readBeforeEdit` only matches literal `read` tool; ignores `bash cat`, and doesn't treat `write(p)` as implicit read-for-edit of `p` |
| may C1.1 | Same as coach — `cron:project-resume` handler uses `bash cat` for file inspection |

## (3) Concrete proposals

### Proposal A — Coach skill: `convention-regression-triage.md` (cheap, ~15 min)

File: `agents/coach/skills/convention-regression-triage.md`. Contents: the 5-step recipe above, with canonical paths hard-coded:

- DB: `.state/may.db`, table `convention_checks` (columns: `sessionId, agent, convention, passed, violation`)
- Checker source: `agents/may/handlers/convention-check.ts` (functions `checkC<N>_<K>_*`)
- Session transcript: `.state/sessions/history/<sessionId>/session.jsonl`
- Briefs live in: `agents/coach/workspace/brief-<agent>-<conv>-<tag>.md` (⚠ gitignored; commit workaround needed or use `--force`)
- Known FP classes to check first before calling a regression real: (i) bash-as-read, (ii) head/tail/cat/git not whitelisted, (iii) write-implies-read-for-edit, (iv) zero-op quiescent heartbeats.

This directly addresses the **~55 ops of duplicated path/checker hunting across the 3 sessions.**

### Proposal B — R1 dispatch (ONE intervention, not stacking)

**Dispatch P1 to `may`:** patch `agents/may/handlers/convention-check.ts` to:
1. In `checkC1_1_readBeforeEdit`, count `bash` calls whose command matches `/\b(cat|head|tail|less|grep|jq|awk|sed)\b\s+[^|>&]*<path>/` as a read of `<path>`. Also treat a prior `write(p)` as satisfying the read-before-edit requirement for `p`.
2. In the `C1.7 VERIFICATION_PATTERNS` array, add: `git log`, `git status`, `git show`, `git diff`, `cat`, `grep`, `jq` (alongside the existing `head`/`tail` added in `b00ea81e3`).

Expected impact: C1.1 false-positive rate drops ~80% (per coach's brief), C1.7 residual ~15% drops near zero (per scout's brief). **Reclaims ~5 pass-rate points per affected agent without any behavioral change**, and makes future regression alerts actually actionable.

**Why this is safe under KE-123:** no behavioral intervention is being dispatched here. The three prior coach investigations were *diagnostic*, not interventions. A checker-accuracy fix is an infra change, orthogonal to the "don't stack behavioral interventions" rule. It also explicitly unblocks the brief recommendations (coach's C1.1 brief already called for exactly this infra ticket; it hasn't been dispatched yet — verified via `requests` table, no `toAgent='may'` non-cron task in last 7d referencing C1.1/C1.7).

### R1 (decision)

**DISPATCH** — single P1 request to `may` to fix `convention-check.ts` (both C1.1 and C1.7 gaps). Plus optional P2 follow-up to coach to materialize the triage skill.

Example dispatch body:
> Patch `agents/may/handlers/convention-check.ts` per `agents/coach/workspace/brief-coach-c11-regression.md` and `brief-scout-c17-regression.md`. In `checkC1_1_readBeforeEdit`, treat `bash cat|head|tail|less|grep|jq <path>` and prior `write(p)` as reads. In C1.7 `VERIFICATION_PATTERNS`, add `git log/status/show/diff`, `cat`, `grep`, `jq`. Add a unit test covering both classes. Budget ≤25 ops.

## Notes / caveats

- Only 3 sessions is a small n; the skill is low-risk because it just documents canonical paths. If adoption turns out to be zero (per KE-140 Level-4 context.md pattern), no harm done — and coach only fires this workflow a few times/week so instrumentation isn't urgent.
- The checker fix has higher leverage: it affects **every** future convention regression alert for **every** agent, not just coach's investigation cost.
- Did not dispatch in this session — optimizer's role is scouting; tech-lead or may itself owns the patch. Leaving R1 explicit; a subsequent heartbeat can fire the dispatch if this finding is read in time. If the dispatch window passes (>24h) and another regression fires, re-evaluate.
