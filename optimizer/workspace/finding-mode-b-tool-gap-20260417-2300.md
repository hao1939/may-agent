# Finding: Mode B — Tool Gap 6h Bash Pattern Scan (2026-04-17 23:00 UTC)

**Session**: s_1776466866085_687 (optimizer heartbeat, Mode B rotation)
**Window**: last 6h, sessions with `opCount ≥ 25`, agents in {coach, coder, scout, tech-lead}
**Source**: `.state/may.db sessions` + per-session `.state/sessions/history/<sid>/session.jsonl` (`assistant.content[].toolCall`)

## TL;DR — **NO_DISPATCH (dedupe of 21:00 UTC finding)**

The dominant recurring bash-chain in the last 6h is **transcript inspection of `.state/sessions/history/*/session.jsonl`** (33 occurrences across 4 of 5 top-op sessions). This is the **exact pattern** already analyzed & held 2h ago in `finding-tool-gap-mode-b-0417-3.md` (NO_DISPATCH, pending gym-batch `--inspect` landing + KE-123/KE-026). No new qualifying pattern crossed the ≥3 incidents × ≥2 agents bar. Holding.

## 1. Top 5 sessions surveyed

| sessionId | agent | ops | task (trunc.) |
|---|---|---:|---|
| s_1776451760999_560 | coach | 59 | Investigate scout C1.7 convention regression (req:4c8624dd) |
| s_1776453558249_577 | coach | 44 | Investigate coach C1.1 convention regression (req:7b51a6f7) |
| s_1776445332324_510 | coder | 41 | may/convention-check review-only exemption fix |
| s_1776453350862_574 | scout | 39 | Audit 3 recently-landed tech-lead commits |
| s_1776464362791_664 | coach | 34 | Investigate may agent C1.1 convention regression (97%→92%) |

## 2. Pattern frequency table (across the 5 sessions)

| Pattern | Occurrences | Sessions affected | Est. ops wasted/6h | Status |
|---|---:|---:|---:|---|
| **P1 session.jsonl transcript inspect** (tail/grep/bun -e JSON parse) | **33** | 4 (coach×3, scout not hit — coach-heavy) | ~50 (inline re-invented parser in python3 heredoc + bun -e) | **ALREADY DISPATCHED/HELD** — see `finding-tool-gap-mode-b-0417-3.md` (NO_DISPATCH pending gym-batch `--inspect`) |
| **P2 `git log`-as-archaeology** (log --all, --pickaxe / -S, --follow, --grep, show --stat chains) | **34** | 2 (coach s_560=19, scout s_574=10, coder s_510=4) | ~25 (pickaxe+show loops hunting "when was X added") | **BELOW THRESHOLD** (2 agents qualifying; ≥3 needed for a dispatch) — watch list |
| **P3 grep/rg code spelunking** for convention text (`"without prior read"`, `"C1.1"`) | **41** | 4 (coach×3, coder×1) | ~15 (covered by existing `scripts/code-search.ts`, adoption=0) | Existing tool available, adoption problem (KE-123) |
| P4 `find` discovery spirals | 10 | 3 | ~5 | Below threshold |
| P5 `tsc --noEmit && vitest` typecheck-then-test | 8 | 1 (coder only) | ~3 | Already appropriate tooling |
| P6 `bun -e "…bun:sqlite…"` ad-hoc DB query (PATH+quoting boilerplate) | 14 calls across s_560 & s_664 (counted via `bun -e` prefix, not matched by the strict regex) | 2 | ~4 | Partially covered by `scripts/session-query.ts`, zero adoption |

**Raw counts (strict regex):** `{jsonl:33, git:64 (gitLog:34), grepCode:41, find:10, tsc:8, bunDb:1}`

## 3. Candidate analysis — **ONE** top candidate, but held

**Top new-ish candidate: P2 `git log`-as-archaeology "when was this added?" chain.**

**Current chain (coach s_560, hunting when `bhead/btail` verifiers landed in `convention-check.ts`):**
```
cd agents && git log --oneline -p -- may/handlers/convention-check.ts | grep -B2 -A2 "bhead\|btail" | head -40
cd agents && git log --all --oneline -- may/handlers/convention-check.ts | head -10
cd agents && git log --all --oneline --pickaxe-regex -S'\bhead\b' -- may/handlers/convention-check.ts | head -5
cd agents && git show --stat 053904b9b -- may/handlers/convention-check.ts
cd agents && git show 053904b9b -- may/handlers/convention-check.ts | head -60
cd agents && git log --format="%H %ai %s" b00ea81e3 -1
cd agents && git log --all --format="%H %ai %s" --pickaxe-regex -S'\bhead\b' -- may/handlers/convention-check.ts | head
```
≈ 8–12 bash calls. Same shape in scout s_574 (10 calls: git log --all --grep, show --stat, diff d15c5249 HEAD).

**Proposed tool sketch:** `scripts/git-when.sh <regex> [--path glob] [--show]`
- Runs `git log --all --oneline --pickaxe-regex -S"<regex>"` (agents repo)
- For top 3 hits, runs `git show --stat <sha>` and prints `"<short-sha> <iso-date> <author> <subject>"`
- `--show` prints the full diff hunk containing the regex for the first match
- Optional `--since`/`--until` date filter
- Est. savings: collapses 6–8 calls into 1 → **~5 ops/occurrence** × ~5 occurrences/6h ≈ **20 ops/day, $1/day**

**Dispatch target:** tech-lead. Very small script (≈40 lines).

## 4. Why NOT dispatching right now

1. **Threshold miss.** P2 hits only 2 agents in-window (coach & scout; coder's 4 git-log calls are normal commit-history lookups, not pickaxe hunts). The rule per prior Mode B findings is **≥3 agents × ≥3 incidents**. P2 is 2 agents × ~15 incidents → one-agent-dominant (coach s_560 alone = 19 git calls).
2. **KE-123 non-stacking.** An active `gym-batch.sh --inspect` dispatch from ~19:00 UTC is still in tech-lead's backlog (not yet landed as of 23:00 UTC per `ls scripts/ | grep inspect` = empty). Dispatching a second small CLI script into the same recipient within 4h stacks interventions and will slow both.
3. **Adoption ceiling.** Nearest analog `scripts/code-search.ts` (grep-chain collapse, built Apr 12) has **zero adoption outside optimizer** despite being in coach/context.md. Same Level-4 adoption problem per `finding-tool-adoption-patterns-0412.md`. A Level-1 fix (handler code) would outperform a Level-4 tool, but P2 isn't called from any handler — it's free-form heartbeat/investigation work, which is where KE-026 (pull-model discovery dead) bites.
4. **Coach-concentrated waste has a better upstream fix.** 3 of the 5 top-op sessions are coach investigating a convention regression and re-deriving `convention-check.ts` behavior from git history. The structural fix is **making `agents/may/handlers/convention-check.ts` emit a diagnostic link in its violation output** (e.g. `"rule defined at: …convention-check.ts:L373 (commit <sha>, <date>)"`) so coach stops spelunking. Parking as a Mode D/A candidate, not a Mode B tool dispatch.

## 5. Dedupe note vs. prior findings

| Prior finding | Pattern covered | Verdict there | Status now |
|---|---|---|---|
| `finding-tool-gap-mode-b-0417-3.md` (21:00 UTC) | P1 session.jsonl inspection | NO_DISPATCH pending gym-batch --inspect landing | **Unchanged** — gym-batch --inspect still not landed (confirmed `ls scripts/` has no `inspect-*`); hold. |
| `finding-tool-gap-mode-b-20260417-1430.md` | P1 gitignore-detective | NO_ACTION (held for follow-up ping) | Not hit in this window (0 occurrences in top 5). |
| `finding-tool-gap-mode-b-0417.md` (19:00 UTC) | gym-trial transcript inspect (`/tmp/gym-run-*`) | **DISPATCHED** to tech-lead | Still in flight. |
| `finding-bash-command-patterns-0411.md` (baseline) | generic bash taxonomy | — | Categories consistent. |
| `finding-tool-gap-analysis-0413.md` (scout baseline) | scout-specific gaps | — | scout s_574 today shows same `git show --stat` pattern but for a code-review task, not tool-gap. |

**No new pattern deduped away yet — but no new pattern qualifies, either.**

## 6. Final verdict

**R1 = NO_DISPATCH this slot.**
**R2 = Queued watch-list:**
- If P2 `git log`-as-archaeology hits ≥3 agents in next 24h → dispatch `scripts/git-when.sh` sketch to tech-lead as a small follow-on *after* `gym-batch.sh --inspect` lands.
- If P1 inspection volume rises above ~60/6h → escalate Level-1 proposal to extract transcript parser from `agents/may/handlers/convention-check.ts:L373` into `src/lib/session-transcript.ts` (real structural fix, matches KE-017 / materialize pattern).
- If coach continues re-deriving convention-check behavior from git history → propose emitting a diagnostic link in violation outputs (Mode D candidate).

## 7. Deliverables checklist

- [x] Top 5 sessions surveyed (§1)
- [x] Pattern frequency table (§2)
- [x] ONE top candidate with current chain, proposed tool, est. savings, dispatch target (§3)
- [x] Dedupe note vs. prior findings (§5)
- [x] Dispatch decision + rationale (§4, §6) — **not dispatching**
- [x] File written
- [x] todo.md rotation marker appended

**Budget**: 13 ops used (within ≤25 cap).

[SIG: 1776466866:mode-b-2300-no-dispatch]
