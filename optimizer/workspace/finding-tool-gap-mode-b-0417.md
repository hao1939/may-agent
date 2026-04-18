# Finding: Tool Gap Mode B — Gym Transcript Inspection Pattern (6h)

**Date**: 2026-04-17 ~17:00 UTC
**Session**: s_1776445268672_509 (Mode B — Tool Gap Analysis, 6h)
**Method**: Extracted bash commands from `session.jsonl` for the top 14 sessions (opCount ≥15) started in the last 6h. Grouped repeated subsequences; classified each recurring pattern by *adoptability* (can it be wired into a workflow/handler, or only invoked from free-form heartbeats?).
**Prior work**: [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md), [finding-tool-adoption-patterns-0412.md](finding-tool-adoption-patterns-0412.md) (5-level adoption hierarchy), [finding-tool-adoption-pattern-mining-0412.md](finding-tool-adoption-pattern-mining-0412.md) (context.md mentions = DEAD).

---

## Executive Summary

One **highly recurring, structurally-adoptable pattern** was found: **gym-batch post-run transcript inspection**. Across 3 of the 14 sessions (all coach `prove-the-loop` iterations), agents spent 10–25 bash calls per session chasing finish-call/guard-trigger/verification-evidence data out of individual trial `session.jsonl` files with `find /tmp/gym-run-*`, ad-hoc `python3 <<PY` / `bun -e` transcript parsers, and repeated `grep`s. The same information is already structured inside `gym-batch.sh`'s per-trial result JSON but not surfaced to callers beyond pass/fail totals.

**Recommendation**: Add a `--inspect <field>[,<field>...]` flag (or a sibling `scripts/gym-inspect.ts`) to `gym-batch.sh` that, after the run, extracts per-trial {sessionId, session.jsonl path, finish calls w/ verification_evidence, guard-trigger lines matching a user-supplied regex, last N tool names} into `results.jsonl`. That is the ONE thing coach is manually re-deriving every iteration.

**Est. savings**: ~10–20 ops × ~6 prove-the-loop sessions/day ≈ **60–120 ops/day (~$3–6/day)**. Modest but real, and — critically — the tool has a **natural adoption path** because `gym-batch.sh` is already in coach's `context.md` AND in the 42+ confirmed adopting sessions. Every current caller of `gym-batch.sh` is a candidate inspector.

Three other patterns were observed but rejected for tool-building (see §5).

---

## 1. Data Collection

**Query**: `SELECT sessionId, agent, opCount, kind, source, workflowRunId FROM sessions WHERE startedAt >= now-6h AND opCount >= 15 ORDER BY opCount DESC LIMIT 25`

Top 14 analyzed (bash-call counts extracted from `session.jsonl`):

| session | agent | ops | bash | kind | source |
|---|---|---|---|---|---|
| s_1776442914838_479 | tech-lead | 74 | 56 | job | agents.fork (P0 refactor) |
| s_1776434074191_370 | coach | 62 | 62 | call | **workflow** prove-the-loop Iter 11 |
| s_1776432517875_300 | coach | 55 | 52 | job | **prove-the-loop resume** |
| s_1776438071728_429 | coder | 51 | 47 | call | workflow (feedback-loop M2) |
| s_1776427541234_215 | coach | 44 | 33 | job | cron:project-resume → prove-the-loop |
| s_1776436033817_399 | coach | 43 | 43 | job | cron:project-resume → prove-the-loop Iter 12 |
| s_1776437912999_423 | tech-lead | 42 | — | job | M2 impl |
| s_1776443173581_485 | coder | 42 | — | call | workflow |
| s_1776443530412_493 | scout | 41 | — | call | workflow (DD promotion) |
| s_1776441294847_464 | coach | 38 | — | job | may C1.4 regression |
| s_1776432750105_313 | bob | 37 | — | call | workflow |
| s_1776441798729_472 | coder | 35 | — | call | workflow |
| s_1776436387312_409 | scout | 30 | — | call | workflow |
| s_1776444880857_502 | coach | 30 | — | job | weekly promoted-skill regression |

## 2. Pattern Mining

### 2A. Gym transcript inspection (**WINNER**)

Sessions: `s_1776434074191_370`, `s_1776432517875_300`, `s_1776436033817_399` (all coach prove-the-loop).

Template sequence after each `scripts/gym-batch.sh` call:

```
# Find the per-trial session dirs
find /tmp/gym-run-*/state/sessions/history -name "s_177...*" 2>/dev/null
# Look for guard fires / finish calls / verification_evidence
grep -h "Evidence-Count Mismatch\|VERIFICATION DEPTH\|blocked" <path>/session.jsonl
grep '"name":"finish"\|verification_evidence' <path>/session.jsonl | head -5
# Parse JSONL with an ad-hoc python3 heredoc
python3 <<'PY'
import json
for i,l in enumerate(open('...session.jsonl')):
    o=json.loads(l) ...
PY
# Repeat for 5-10 sessionIds
for sid in s_... s_... s_... ; do
    f=$(find /tmp -path "*$sid*session.jsonl" | head -1)
    ...
done
```

**Op cost per session**: measured on three sessions (see bash-greps in §1) —
- s_1776432517875_300: 23 of 52 bash calls matched `gym-run-*/session.jsonl` (44%)
- s_1776436033817_399: 12 of 43 bash calls + 5 separate `python3 <<PY` transcript parsers (40%)
- s_1776434074191_370: 10 of 62 bash calls (16%)

**Telltale**: the same session re-invents the transcript-parsing heredoc each time (s_1776436033817_399 has 5 near-identical `python3 <<'PY'` blocks differing only by what field they print — Iter 12).

**Coach prove-the-loop volume**: 12 sessions ≥15 ops in last 24h (total 462 ops, query in §6). Pattern applies to ~6/day that include gym runs.

### 2B. Observed-but-not-adoptable

- **Test fail triage** (s_1776442914838_479, tech-lead P0 refactor): 10+ consecutive `bun vitest --run ... | tail` calls to find which test file failed. Already an existing tool gap (see 0411 finding), but the caller is a single free-form P0 dispatch, not a workflow step → no structural adoption path. Skip.
- **grep/rg exploration chains** (coder sessions 3 and 8): `scripts/code-search.sh` already exists for this (built Apr 12). Session `s_1776438071728_429` actually *uses* `code-search.sh` 6 times. Adoption is fine; no new tool needed.
- **sessionId-to-path lookup** (appears in 4 sessions): `find /tmp -name "s_<id>*"` + `ls <path>`. Small (1-2 ops); bundling into the inspection tool above absorbs it for free.

## 3. Proposed Tool

### Option A (lean, preferred): extend `gym-batch.sh` with `--inspect`

```bash
scripts/gym-batch.sh \
  --scenario multi-file-verify-gap \
  --agent coder --trials 10 --variants on,off \
  --inspect "finish,verification_evidence,guard:Evidence-Count,guard:VERIFICATION DEPTH"
```

After each trial, pluck from `<run>/state/sessions/history/<sid>/session.jsonl`:
- the full `finish` tool call object(s) (args only) → `finish_calls`
- any assistant/toolResult line matching each `guard:<regex>` → `guard_hits`
- last 10 tool-call names → `tail_tools`
- resolved `session_path` for ad-hoc follow-up

Emit into the existing `results.jsonl` next to `_trial`/`_variant`. Callers then do **one** `bun -e "...query results.jsonl..."` instead of 10-25 grep/find/python heredocs.

**Code size**: ~60 lines of bash + a single `bun` helper script `scripts/inspect-session-jsonl.ts`.

### Option B: separate `scripts/gym-inspect.ts`

Runs against an existing `results.jsonl`. Same fields. Lower coupling but requires callers to remember a second command.

**Recommend A** — adoption trick is "no extra command". Every `gym-batch.sh` invocation in a workflow is an adoption site.

## 4. Adoption Analysis (the critical filter)

Per [finding-tool-adoption-patterns-0412.md](finding-tool-adoption-patterns-0412.md), tools sink without a Level 1–3 structural home. Adoption check for this tool:

| Level | Path | Status |
|---|---|---|
| 1. Workflow JS code | N/A — coach prove-the-loop is free-form | ❌ |
| 2. Handler code (cron.json) | `agents/may/handlers/project-resume.ts` fires coach for prove-the-loop iterations | ⚠️ indirect |
| 3. Dispatch template prompt | Coach's iteration prompts (generated in `prove-the-loop.md` playbook) routinely say "run gym-batch.sh then inspect trial transcripts" | ✅ |
| 4. context.md mention | coach already has gym-batch.sh in context | Not sufficient alone |
| 5. Ad-hoc | current state | — |

**Crucial**: Level 3 is live because coach *reads its own project playbook* on each iteration. The playbook line "inspect trial transcripts" is where we wire the new flag: one-line edit in `agents/coach/workspace/projects/prove-the-loop.md` to say "run `gym-batch.sh ... --inspect <fields>` and parse `results.jsonl`." That is the structural adoption slot.

Bonus: if coach-project-playbook is the adoption slot, this **also tests** whether documented best-practice inside a project file drives tool adoption — a new data point for KE-020/KE-026.

## 5. Negative Results (patterns NOT recommended)

- **gym-run-tmpdir → sessionId lookup.** Subsumed into 3A above.
- **bun vitest failure localization.** Real op sink (15+ ops in tech-lead P0) but no recurring adoption surface — each caller is a one-off P0. Skip. Revisit if the pattern surfaces inside a workflow (e.g., coder D-o-R Phase 4).
- **grep + tsc + rerun** on coder workflows (s_1776438071728_429, 47 bash). Distributed waste, no single-tool fix. The coder workflow itself is the leverage point.

## 6. Estimated Savings

- 6 coach gym-heavy sessions/day × ~15 ops saved (median of 10/12/23) = **~90 ops/day, ~$4.50/day**.
- Low-end bound; doesn't count the skim-on-skim re-reads and heredoc rewrites.
- Also reduces coach session opCount by enough that the ≥40-op bloat tail compresses (currently 5/14 sessions in sample ≥40 ops are gym-inspect driven).

Volume query:
```sql
SELECT count(*), sum(opCount) FROM sessions
WHERE agent='coach' AND startedAt >= now-24h
  AND task LIKE '%prove-the-loop%' AND opCount >= 15
-- → 12 sessions, 462 ops total
```

## 7. Action

- **Dispatch P2 → tech-lead**: Implement Option A (`--inspect` flag in `scripts/gym-batch.sh` + helper `scripts/inspect-session-jsonl.ts`). Est. 60 LOC + 1 test.
- **Coach playbook edit** (self, not tech-lead): After tool lands, edit `agents/coach/workspace/projects/prove-the-loop.md` to reference `--inspect` in the iteration template.
- **Measurement**: After 48h, re-run this query and check whether coach prove-the-loop median opCount drops and `find /tmp/gym-run-*` bash frequency falls toward zero.

---

**Verdict**: ONE adoptable pattern found. Others observed but correctly rejected on adoption-path grounds (per our own Apr 12 kill rule for context-only tools).
