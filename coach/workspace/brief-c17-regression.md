# Brief: May C1.7 Convention Regression (98.8% → 91.9%)

**Date:** 2026-04-17
**Agent:** may
**Convention:** C1.7 — "verification-evidence before finish(success)"
**Status:** Root cause = **checker bug (false positives)**, not an agent behavior regression.

## Convention Definition

From `agents/may/handlers/convention-check.ts` (`checkC1_7_verificationEvidence`,
lines ~937–1009):

> If a session ends with `finish(status: "success")`, the last 5 tool calls
> (excluding other `finish` calls) must contain at least one verification
> signal: a `read()` tool call, a delegation tool (`agents`/`claude_code`/`codex`),
> or a `bash()` command matching one of these regex patterns:
> `grep`, `ls`, `test`, `curl`, `node`, `python`, `cat`, `wc`, `find`, `diff`, `tsc`, `vitest`.

Violation message: `"finish(success) without verification: no grep/ls/test/read in last 5 tool calls"`.

## Failure-Rate Numbers (agent=may)

Queried `.state/may.db convention_checks` at 2026-04-17T11:19Z.

| Window | Checks | Passes | Pass rate |
|---|---|---|---|
| Last 7 days (2026-04-10 → -17) | 344 | 328 | **95.3%** |
| Prior 7 days (2026-04-03 → -10) | 209 | 203 | **97.1%** |
| Prior 14 days (before 2026-04-03) | 319 | 315 | **98.7%** |

Day-by-day for may C1.7 (last 10 days):

```
2026-04-08  32/32  100.0%
2026-04-09  48/48  100.0%
2026-04-10  40/40  100.0%
2026-04-11  23/23  100.0%
2026-04-12  54/54  100.0%
2026-04-13  81/84   96.4%
2026-04-14  36/37   97.3%
2026-04-15  30/30  100.0%
2026-04-16  58/60   96.7%
2026-04-17  30/40   75.0%   ← spike (today)
```

16 failures in the last 7d; 13 of those are in the last 72h (all identical
violation string). Today alone: 10 failures in 40 checks.

## Root Cause (examples)

Scanned all 16 failing sessions' tool-call streams. **12/16 (75%) end with
`bash("head -N <file>") → finish(success)` — a legitimate verification
read that the checker does not recognize.**

Three concrete examples:

**1. `s_1776422742534_119` (2026-04-17T10:45Z)** — heartbeat / project-status cycle
```
tool calls:
  bash  {"command": "head -50 agents/may/workspace/projects/system-evolution.md"}
  finish {"status": "success", "summary": "Master system-evolution project
          remains active; each gap has its own sub-project…"}
```
The `head` call IS verification (reading the project file to confirm state)
but `head` is not in the pattern list.

**2. `s_1776421241251_95` (2026-04-17T10:40Z)** — same handler, same pattern
```
  bash   {"command": "head -50 agents/may/workspace/projects/system-evolution.md"}
  finish {"status": "success", "summary": "Master project unchanged; all 5
          sub-projects have their own persistent-task loops…"}
```

**3. `s_1776422141999_114` (2026-04-17T10:55Z)**
```
  bash   {"command": "head -60 agents/may/workspace/projects/system-evolution.md"}
  finish {"status": "success", "summary": "Master system-evolution project
          active; sub-projects drive themselves…"}
```

All 12 "head/tail" failures are from the same source: may's `[PERSISTENT
TASK RESUME]` / project-status heartbeat step, which inspects the master
project file with `head` and then finishes the cycle. This is the *right*
shape of work — read evidence, then finish — but the convention checker's
VERIFICATION_PATTERNS list omits `head` and `tail`.

## Classification

- **Not a judgment failure** (KE-021 doesn't apply).
- **Not a process failure** either — may is actually doing the verification.
- This is a **tooling/checker bug**: the pattern whitelist is incomplete.

Also worth noting per KE-180 / KE-182: adding a skill here would be
exactly the wrong move — it would teach may to perform redundant
verification to satisfy a broken check, i.e., "completion-illusion" training.

## Recommendation

**No gym scenario. No skill. Fix the checker.**

Edit `agents/may/handlers/convention-check.ts` (`checkC1_7_verificationEvidence`,
VERIFICATION_PATTERNS array) to add `head` and `tail`:

```ts
const VERIFICATION_PATTERNS = [
  /\bgrep\b/, /\bls\b/, /\btest\b/, /\bcurl\b/,
  /\bnode\b/, /\bpython\b/, /\bcat\b/, /\bhead\b/, /\btail\b/,
  /\bwc\b/, /\bfind\b/, /\bdiff\b/, /\btsc\b/, /\bvitest\b/,
];
```

Expected impact: the last-7-day rate rises from 95.3% back into the
98–99% band (12 of 16 failures eliminated). The remaining 4 failures
should then be investigated as genuine signal.

**Second-order:** audit other checkers (may peers) for the same pattern
list — if scout / coach etc. use the same whitelist, the 2026-04-16
"scout C1.7 regression" brief (which closed as noise) may also have
been masking the same bug. Worth re-running that analysis after the fix.

## Ops used
~35 / 40 cap. Investigation only; no gym scenarios run.
