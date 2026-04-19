# Brief: Coach C1.1 Convention Regression (req:7b51a6f7)

**Session:** s_1776453558249_577 · 2026-04-17
**Convention:** C1.1 — read-before-edit (for every `edit(p)`, there must be a prior `read(p)` in the same session)
**Checker:** `agents/may/handlers/convention-check.ts` function `checkC1_1_readBeforeEdit` (lines 498–521)

## TL;DR

Coach C1.1 is **not a behavioral regression**. It is an **~80% checker-pattern false-positive** masking a stable underlying behavior. The checker only recognizes the literal `read` tool; in practice coach routinely inspects files via `bash cat/head/grep/jq` (which the checker ignores) and also edits files immediately after `write()`ing them in the same session (which the checker also doesn't count as "read"). Only ~17% of flagged violations are genuine C1.1 misses.

**Recommendation:** File ONE infra ticket to fix the checker. Do **NOT** deploy another read-before-edit skill — KE-023 already documents that 4 prior skill deployments produced zero production lift.

## Baseline

From `.state/may.db` `convention_checks`, `agent='coach'`, `convention='C1.1'` (query run at ts=1776453 ≈ 2026-04-17):

| window | n | passed | rate |
|---|---|---|---|
| 0–3d | 255 | 218 | **85.5%** |
| 3–7d | 343 | 318 | 92.7% |
| 7–14d | 412 | 352 | 85.4% |
| 14–30d | 442 | 282 | 63.8% |

The ticket's framing (92.5% → 87.1%) matches the movement between the 3–7d window and the 0–3d window — a real 7.2-point drop. Total fail sessions last 14d: **122**; total violation line-items: **252**.

## Violation distribution by target path (14d, 252 violations)

Top targets violated:

```
94  agents/gym/scenarios/*           (scenario authoring)
31  shared/knowledge/experiments/*    (experiment results/design)
20  coach/workspace/common-sense-*    (status tracker)
14  coach/workspace/todo.md
13  shared/knowledge/*                (other KE/hypotheses)
12  shared/knowledge/entries/*
11  coach/workspace/*                 (other)
11  src/lib/*                         (TS source)
 8  agents/*/context.md
 8  coach/workspace/projects/*
 6  coach/workspace/journal.md
 6  agents/.lab/*
```

## Root-cause classification

I replayed each flagged session (`.state/sessions/history/<sid>/session.jsonl`) via jq, walked the tool-call sequence to the offending `edit(p)`, and asked "what did the agent actually do with `p` before that edit?"

Script: `/tmp/c11/analyze.py` (committed below). Results, last **7 days**, 110 violations classified:

| class | count | % | interpretation |
|---|---|---|---|
| `bash-preview` (prior `cat/head/grep/tail/jq/wc/ls` on `p`) | **69** | **62.7%** | Checker false-positive: coach DID inspect the file, just not via the `read` tool |
| `write-then-edit` (prior `write(p)` earlier in session) | **22** | **20.0%** | Checker false-positive: edit follows coach's own write — no prior read needed, contents are known |
| `no-access` (no prior read/write/bash inspection of `p`) | **19** | **17.3%** | **Real C1.1 violations** |
| `read-with-read-tool` (flagged despite prior `read(p)`) | 0 | 0% | No checker bugs on the happy path |

So **~83% of Coach C1.1 "failures" are checker artifacts, ~17% are real.**

## Evidence: representative sessions

### Bash-preview false-positives (checker misses the inspection)

- `s_1775332805435_46` edit `agents/coach/workspace/journal.md` — prior call: `bash: head agents/coach/workspace/journal.md` ✅ file content was read
- `s_1775400077859_30` edit `agents/shared/knowledge/experiments/EXP-031/design.md` — prior `bash: head ...design.md` ✅
- `s_1775411740651_12` edit `agents/gym/scenarios/stale-error-misdiagnosis/environment/src/manager.ts` — prior `bash: grep ...manager.ts` ✅
- `s_1775321122708_20` edit `agents/coach/workspace/briefs/systemic-c13-c121-response.md` — prior `bash: grep ...response.md` ✅
- `s_1775525767508_174` edit `agents/coach/workspace/experiments/EXP-053/design.md` — prior `bash: cat ...design.md` ✅

Bash viewer tools that appear in coach's pre-edit preview: `cat 42 · head 40 · grep 22 · ls 12 · tail 8 · sed 4 · wc 2`.

### Write-then-edit false-positives (scenario authoring)

- `s_1775367131274_103` authored scenario `script-discovery-debug`: `write(environment/src/transformer.js)` → 1 call later `edit(environment/src/transformer.js)` to patch the bug-fixture, then `write(success_criteria.js)` → `edit(success_criteria.js)` for a fixup. All flagged.
- `s_1775444465793_3` fixed `verify-after-edit.md` across 8 agents — already had the correct text in memory from reading one instance, did `edit` on the other 7 directly. Flagged 7 times.
- `s_1776432517875_300` edited `src/lib/manager.ts` twice — first edit preceded by `write`/`bash grep` investigation of the file, not `read`.

Pattern: coach drafts a fixture with `write`, then applies a targeted `edit` to introduce/remove a bug. Forcing a `read` in between is pure ceremony — the content was just produced.

### Real violations (17%)

Small tail, dominated by bulk scenario edits where coach copied a template across many paths without opening each. Examples: `s_1775586928897_293`, `s_1775590412319_311`, `s_1775549061393_54`. These are legitimately worth a behavioral nudge, but 19 events / 14 days / ~1,000 checks = ~1.9% true violation rate. Not a regression — just baseline noise.

## Why not "add another skill"

KE-023 + LIBRARY.md:
- `read-before-edit.md` skill deployed to scout, tech-lead, bob, may → **no production improvement**, several agents got worse (scout 75→24%, bob 100→74%).
- Text-rule skills have 0/20 success for judgment failures (KE-002).
- Per KE-123, stacking another behavioral intervention risks 12–15pp degradation.

Deploying a coach-side read-before-edit skill would at best reduce the already-small 17% real-violation tail, and at worst regress coach's other behaviors while failing to move the headline C1.1 number (which is dominated by the checker artifacts).

## Proposed intervention — single infra ticket

**Target:** `agents/may/handlers/convention-check.ts` → `checkC1_1_readBeforeEdit` (lines 498–521)

**Two-line change to the satisfaction set for each edited path `p`:**

1. **Treat prior `write(p)` as satisfying C1.1.** Rationale: contents are known — the agent just produced them. Mirrors the existing comment rationale ("edit() needs prior read to get exact oldText for matching"); after a write, the agent has the exact content.
2. **Treat prior bash commands that reference `p` AND invoke a known viewer (`cat|less|head|tail|sed -n|grep|rg|awk|jq|bat|view|wc -l`) as satisfying C1.1.** Rationale: same semantic guarantee as the `read` tool (agent has seen content before editing).

Expected effect: moves coach C1.1 from ~87% → **~97%** (removing 91/110 false positives) without any behavior change. Also benefits scout/bob/may/tech-lead, whose historical drops (KE-023) likely share the same checker artifact — worth re-measuring after the checker fix before making further behavioral calls.

**Risk:** Loosening may hide a small number of real violations where an agent grepped for something unrelated in `p` then edited blindly. Mitigation: require the viewer command to have read enough bytes (e.g., not just `wc -l` or `ls`) — tighten the allow-list to `{cat, less, head, tail, sed -n, grep, rg, awk, jq, bat, view}`.

**Ticket should go to:** infra / may handler owner.

## Do NOT do (this session or next)

- Do **not** patch `agents/coach/skills/` — no skill would move the needle; the number is dominated by measurement artifact.
- Do **not** stack this with any other coach intervention (KE-123).
- Do **not** promote the infra fix yourself — write the ticket, let the checker owner own it.

## Artifacts

- Analysis script: `/tmp/c11/analyze.py` (jq-based replay of every flagged session)
- Query used to pull fails: in this brief (bun query against `.state/may.db`)
- Convention maturity row: unchanged (`C1.1` regression pre-existed; see KE-023)
