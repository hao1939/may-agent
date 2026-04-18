# Brief: bob C12.1 regression (last 7d vs prior)

Author: coach (session s_1776482361684_813, 2026-04-18)
Request: req:368e003a (convention-check)

## (1) Headline numbers (from `.state/may.db convention_checks`, agent='bob', convention='C12.1')

| Window | Pass | Checks | Rate |
|---|---|---|---|
| 24h | 50 | 66 | **75.8%** |
| 3d  | 210 | 242 | 86.8% |
| 7d  | 625 | 658 | **95.0%** |
| 14d | 1038 | 1093 | 95.0% |
| 30d | 1158 | 1418 | 81.7% |

By-day rate (last 10 days):
```
2026-04-09  98.5%  n=136
2026-04-10 100.0%  n=73
2026-04-11 100.0%  n=52
2026-04-12 100.0%  n=129
2026-04-13  99.3%  n=149
2026-04-14 100.0%  n=86
2026-04-15  98.5%  n=66
2026-04-16  92.2%  n=103
2026-04-17  65.2%  n=66    ← cliff
2026-04-18 100.0%  n=7
```

Cliff on 2026-04-17, not a gentle drift. The dispatch headline "99.8% → 87.5%" matches this shape (a different window + rounding than mine).

## (2) Failure-mode breakdown (33 fails in last 7d)

Violation strings:
- **26 × `first was bash()`** — quiet heartbeats whose first tool call is a bash one-liner.
- 4 × `first was finish()` or `first was write(...)` — one-shot task sessions where bob finished without reading a context file.
- 3 × `first was read(...)` with paths under `/tmp/`, `/app/src/`, `agents/shared/designs/` — paths that the checker doesn't recognize as "orientation" (not a workspace/knowledge/skills path, not a whitelisted filename).

Session kind/source of the 33:
```
job/null         23   (heartbeat cron)
job/agents.fork   5   (forked work sessions)
call/workflow    5   (persistent-task iterations)
```

## (3) Tool-call forensics on the 26 "first was bash()" fails

Extracted first assistant tool call from `.state/sessions/history/<sid>/session.jsonl` for every 7d fail:

- **21 / 26** start with the command:
  ```
  echo "=== Recent experiments ===" && ls -lt agents/shared/knowledge/experiments/ | head -8 && echo "=== Recent deep-dives ===" && ls -lt agents/shared/knowledge/library/deep-dives/ | head -5 && echo "=== Recent KB commits ===" && cd agents && git log --oneline -5 -- shared/knowledge/
  ```
  This is **verbatim the one-liner in `agents/bob/heartbeat.md` Step 1 (OBSERVE), line 18** — bob is doing exactly what his heartbeat tells him to do. It's an `ls`+`git log` orientation scan. It just happens to start with `echo`.
- **5 / 26** start with `export PATH=".state/.bun/bin:$PATH"; bun -e "import {Database} ..."` — production sqlite queries the agent runs to look at `may.db` as orientation.

## (4) Root cause — checker whitelist gap (not an agent regression)

`agents/may/handlers/convention-check.ts` lines 880–928 (`checkC12_1_sessionStart`) accept an early bash call as orientation only if, after stripping `cd ... &&` and `export VAR=... &&` prefixes, the remaining command matches:

```js
/^(grep|rg|find|ls|cat|head|tail|git|bun)\b/
```

Neither `echo` nor the compound `export PATH=…; bun -e "…"` form (note: separator is `;`, not `&&`, so the `export` stripper does not match) passes this regex. So:

- Bob's Step 1 one-liner ⇒ first shell verb after stripping is `echo` ⇒ **C12.1 fail**, every time it runs.
- Bob's db-query pattern ⇒ `export …; bun -e …` ⇒ stripper only strips `&&` forms ⇒ **C12.1 fail**.

Both are genuine orientation scans. The checker's whitelist is what regressed its own scoring, not bob's behavior.

**Why the cliff on 2026-04-17?** Commit history shows the `echo "=== Recent experiments ==="` one-liner was briefly replaced with `cd agents && git log …` in `d60d84d19` (2026-04-15 17:24) — which *would* have passed the whitelist — then reverted back to the echo form in `bc99a85f9` (2026-04-15 17:32). Heartbeat cadence + cache effects mean the full impact lands one-to-two days later as quiet cycles accumulate. On 2026-04-17 cron ran many "nothing to do" heartbeats where bob's *only* pre-finish action is the Step 1 one-liner, and every one of those fails C12.1.

This is **the same class of finding** as the scout C1.7 brief (f35bb2988) and the amy C7.1/C12.1 brief (6d3c6699c): a convention check scoring a legitimate agent pattern as a violation because of a narrow pattern match.

## (5) Recommendation — checker fix, not an agent intervention

**Root-cause category: checker** (primary) + **scenario/heartbeat content** (secondary contributor).

**Do not design a skill.** Bob is already orienting. Behavioral interventions stack against 0-delta root causes (KE-123) and text rules don't change tool-call shape (KE-002, KE-006).

### Primary recommendation (one-line checker patch)

In `agents/may/handlers/convention-check.ts` `checkC12_1_sessionStart`:

1. **Add `echo` to the orientation-bash whitelist** — an `echo "=== header ===" && ls …` pattern is a labelled orientation scan, not arbitrary execution. Add `echo` to the regex alternation at L926.
2. **Strip `export …; ` prefixes (note `;` separator, not just `&&`)** — match the shell reality that agents use. Add a second strip pass in the loop at L914–924 that handles `;`-separated prefix commands.

Expected effect: `bob` 24h rate 75.8% → ~98%+; 7d rate 95.0% → ~99%. Same patch helps any agent whose heartbeat opens with `echo` or with a `; `-separated env setup.

### Secondary recommendation (heartbeat content)

Optional: reorder bob heartbeat Step 1 so the leading verb is `ls` not `echo`:

```bash
ls -lt agents/shared/knowledge/experiments/ | head -8
# then print headers if desired
```

This is cosmetic — the checker patch is the real fix.

### Not recommended

- No skill / no exercise / no SOUL.md edit. There is no judgment failure to train.
- Do not filter gym/cron sessions out of `convention_checks` for this one — that's the right fix for the amy/scout gym-artifact case, but the bob problem is a production-heartbeat pattern, not a gym artifact.

## One-line ask to dispatch
> Patch `checkC12_1_sessionStart` in `agents/may/handlers/convention-check.ts` (a) add `echo` to the bash-orientation regex alternation, (b) also strip `export VAR=…; ` (semicolon-separated) prefixes, not just `&&`. Verify by re-running the checker over the 33 bob 7d fails; expect ≥25 of them to flip to pass.
