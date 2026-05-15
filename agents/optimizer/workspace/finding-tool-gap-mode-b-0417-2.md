# Mode B: Tool Gap Analysis — 6h Bash Pattern Scan (2026-04-17 ~19:00 UTC)

## TL;DR
**Actionable gap found.** The "git history archaeology — when was code X added to file Y" sub-pattern recurs in ≥4 of the top-10 high-op sessions in the last 6h. One coach session (`s_1776451760999_560`, 59 ops) burned **~20 consecutive git-log/git-show/pickaxe calls** answering a single question ("when was the `bhead|btail` regex introduced into `may/handlers/convention-check.ts`?") and also fought shell quoting of `git log -S'\bhead\b'`. This specific sub-pattern was observed by the **Apr-10 tool-gap analysis** ("Pattern 4: Git Archaeology", est. 360–840 ops total) but **no tool was ever built** for it. Proposing **`scripts/git-when.sh <file> <pattern> [--all|--since DATE]`** as a narrow single-call wrapper.

**Est. savings**: conservatively 30–60 ops/day across ~4–6 archaeology incidents/day (coach prove-the-loop debugging, tech-lead regression hunts, optimizer Mode-A archaeology).

---

## 1. Scan Scope

- Window: last 6h (`startedAt ≥ now − 6h`).
- Threshold: `opCount ≥ 20`, any agent.
- Method: `sessions` table via `bun:sqlite` → pulled top-25 sessions; extracted `toolCall` entries from each `session.jsonl`; classified bash commands.
- Prior-work avoidance: Gym transcript inspection (Apr 17 17:00 finding), gitignore-detective (Apr 17 10:30 finding, dispatched/not-built), scenario structural inspection (Apr 17 14:30 finding, below threshold). These three were excluded from the new-pattern search.

| Session | Agent | Ops | git-log calls | git-show calls |
|---|---|---|---|---|
| s_1776451760999_560 | coach | 59 | **16** | **4** |
| s_1776444880857_502 | coach | 76 | 6 | 4 |
| s_1776441294847_464 | coach | 38 | 7 | 0 |
| s_1776442914838_479 | tech-lead | 74 | 1 | 0 |
| s_1776438071728_429 | coder | 51 | 3 | 2 |
| s_1776436033817_399 | coach | 43 | 2 | 1 |
| s_1776427541234_215 | coach | 44 | 3 | 0 |

`git log`+`git show` total across the 7 inspected sessions: **49 calls**.

## 2. The Pattern — "When was code X added to file Y?"

**Concrete recurrence** in `s_1776451760999_560` (coach investigating scout C1.7 regression, trying to find when the C1.7 heuristic's `\bhead\b|\btail\b` regex was added to `may/handlers/convention-check.ts`):

```
28: cd agents && git log --oneline -20 -- may/handlers/convention-check.ts
35: cd agents && git log --oneline -p -- may/handlers/convention-check.ts | grep -B2 -A2 "bhead\|btail\|VERIFICATION_PATTERNS"
36: cd agents && git log --oneline --all -- may/handlers/convention-check.ts
37: cd agents && git show --stat b4684d588 -- may/handlers/convention-check.ts
38: cd agents && git show b4684d588 -- may/handlers/convention-check.ts
40: cd agents && git log --all --oneline --follow -p -- may/handlers/convention-check.ts | grep -n "bhead\\\\b\|btail\\\\b\|^commit "
41: cd agents && git log --all --oneline --follow --diff-filter=AM -p -- ...    # same, with diff-filter
42: cd agents && git log --all --oneline -p -- may/handlers/convention-check.ts 2>&1 | grep -B1 "^+.*bhead"
43: cd agents && git log --all --oneline --pickaxe-regex -S'\bhead\b' -- may/handlers/convention-check.ts   # ← shell-quoting confusion begins
44: cd agents && git show --stat 053904b9b -- may/handlers/convention-check.ts
51: cd agents && git log --format="%H %ai %s" b00ea81e3 -1
52: cd agents && git show 053904b9b -- may/handlers/convention-check.ts | head -60
59: cd agents && git log --format="%H %ai %s" -p --pickaxe-regex -S'\bhead\b' -- may/handlers/convention-check.ts | grep ...
60: cd agents && git log --all --format="%H %ai %s" --pickaxe-regex -S'\\bhead\\b' -- may/handlers/convention-check.ts
```

That's **12 distinct bash calls** (plus ~4 helper greps) to answer **one** question. Root cause of bloat:

1. Agents don't remember the right invocation (`-S<literal>` vs `-G<regex>` vs `--pickaxe-regex -S<regex>`) and iterate.
2. `-S'\bword\b'` needs the regex passed through the shell AND understood by git — naive escaping (the `\\b` attempt on line 60) fails silently.
3. After finding the pickaxe hit, they then run `git show --stat <SHA>` + `git show <SHA> -- <file>` as a second round-trip to see the diff.
4. `--follow` + `--all` + `--diff-filter` get tried one by one as trial-and-error.

Same shape, smaller scale, in other sessions:

- **s_1776441294847_464 (coach, C1.4 regression)**: 7 `git log` calls walking `may/` history to find the commit that changed persistent-task review routing.
- **s_1776436033817_399 (coach prove-the-loop)**: `git log --oneline -20 may/handlers/convention-check.ts` → `git show --stat <sha>` → `git log --all -- shared/workflows/persistent-task.ts`.
- **s_1776427541234_215 (coach)**: `git log --oneline -1 gym/scenarios/fm33-verify-broken/` sequence + `git show`.

## 3. Why existing tools don't cover this

| Tool | Covers? |
|---|---|
| `scripts/session-query.ts` | No — DB only, not git. |
| `scripts/code-search.ts` | No — current-tree grep. |
| `scripts/git-track.sh` (proposed Apr 17 10:30) | No — gitignore detective is a different problem. Also still not built. |
| *(none)* | **Confirmed gap.** |

Note: the Apr-10 Mode B flagged generic "Git Archaeology" (Pattern 4, 360–840 ops) proposing a `git-summary` tool, but it was never implemented and the proposal was too broad. The narrower `git-when <file> <pattern>` has a tighter spec and clearer invocation surface.

## 4. Recommendation — `scripts/git-when.sh`

**Spec (≈30-line bash wrapper):**

```bash
# Usage:
#   scripts/git-when.sh <path> <pattern> [--regex] [--all] [--since DATE] [--show]
#
# Runs `git log --pickaxe-regex -S"$pattern" -- "$path"` (or -G with --regex),
# returns one line per matching commit:
#   <abbrev-sha>  <iso-date>  <author>  <subject>
# If --show is given, for each commit also prints:
#   ---
#   <the hunk(s) in $path touching $pattern>
# cd's to the repo root of $path so it works for both /app and /app/agents.
# Handles pattern escaping so callers don't need to double-escape \b, etc.
# Exits 0 if any match, 1 otherwise.
```

**Usage the coach session would have issued instead:**
```bash
scripts/git-when.sh agents/may/handlers/convention-check.ts 'bhead' --show
# → single call; returns commit SHA + date + diff hunk
```

**Projected savings:**
- Per incident: 8–15 bash calls collapsed to 1 (conservative 8×).
- Observed 3–4 heavy incidents / 6h (coach × 3 + occasional TL/coder).
- ≈ 30–60 ops/day (~$1.50–3/day) fleet-wide. Modest but real, and — unlike the Apr-10 proposal — the spec is narrow enough to actually ship.

**Adoption path:** add to `agents/shared/context.md` under git conventions: *"To find when code was added/removed in a file, run `scripts/git-when.sh <path> <pattern>` instead of chaining git log/show/pickaxe."* Combined with putting the tool next to the already-adopted `scripts/code-search.ts`, this has a reasonable (not great) adoption profile. Per the 5-level hierarchy (Apr-12 tool-adoption-patterns finding), context.md mentions alone = Level 4 ≈ 0% adoption, so the real adoption lever is: (a) cite it in any coach heartbeat prompt that touches regression investigation, or (b) wire it into the common-sense-verify handler when an archaeology-shaped task is detected. These are secondary; shipping the script first is the prerequisite.

## 5. Patterns considered and rejected

| Pattern | Incidents/6h | Why rejected |
|---|---|---|
| `cd /app &&` preamble on every bash | 216 | Single-call convention — no tool fits (already flagged 14:30, still holds). |
| `ls .state/sessions/history/<id>/` → `tail session.jsonl` | ~8 | `scripts/session-query.ts --tools` already covers; real issue is adoption (known), not tool gap. |
| `./node_modules/.bin/tsc --noEmit` × N | 4 (s_479) | That's iterative test-fix, not a discovery pattern. |
| bun:sqlite ad-hoc queries | 22+ | Expected — this IS the right tool for optimizer/coach DB dives; wrapping further would be over-engineering. |

---

## 6. Dispatch

Sending P2 to tech-lead with this finding path. No code proposed directly — spec only — because git pickaxe edge cases (sub-repo detection, regex-vs-string escaping, multi-path) warrant tech-lead's judgment.

**Files referenced:**
- Finding: `agents/optimizer/workspace/finding-tool-gap-mode-b-0417-2.md`
- Prior (avoided): `finding-tool-gap-mode-b-0417.md`, `finding-tool-gap-mode-b-20260417-0800.md`, `finding-tool-gap-mode-b-20260417-1030.md`, `finding-tool-gap-mode-b-20260417-1430.md`
- Apr-10 antecedent: `finding-tool-gap-analysis-0410.md` §Pattern 4
