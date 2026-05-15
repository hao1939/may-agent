# Finding: Mode B — Tool Gap 6h Bash Pattern Scan (2026-04-18 05:00 UTC)

**Session**: s_1776488469884_862 (optimizer work, Mode B rotation)

## TL;DR — **NO_DISPATCH** (P1 rebounded 87→131 but remains coach-convention-regression volume; KE-123 stack still blocks; Mode A may/convention-check.ts dispatch has NOT landed yet)

- R1=NO_DISPATCH — KE-123 stacking (Mode A 00:30 UTC may/convention-check.ts patch + Mode C 23:30 UTC tech-lead inline-diagnostic tweak still in observation; neither landed) + KE-026 Level-4 ceiling; no new actionable shape
- P1 `bun:sqlite` ad-hoc query rebounded **87 → 131 hits** (+51%) this slot, driven entirely by **coach convention-regression job cohort** (766/767/813/854 = 91 hits, 69%) — same pathology Mode A 00:30 already targeted. Still waiting for that patch.
- P2 `session.jsonl` transcript inspection **47 → 93 hits** (+98%), also coach-convention-dominated (same sessions).
- P5 `git-when.sh` **still collapsed at 1 hit** — Mode D follow-up item.
- No new bash pattern crosses ≥3-agents × ≥3-incidents threshold after dedup.

**Window**: last 6h (since 2026-04-17 23:00 UTC), `opCount > 15`
**Source**: `.state/may.db sessions` + per-session `.state/sessions/history/<sid>/session.jsonl` greps

## 1. Sessions surveyed (opCount > 15, last 6h)

| sessionId | agent | ops | kind | bun:sqlite | jsonl | git-when | sq | cs | grep/find/ls |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| s_…_766 | coach | 73 | job | 39 | 32 | 0 | 0 | 0 | 54 |
| s_…_767 | coach | 38 | job | 9 | 0 | 1 | 0 | 0 | 26 |
| s_…_813 | coach | 38 | call | 15 | 19 | 0 | 0 | 0 | 26 |
| s_…_854 | coach | 37 | call | 28 | 15 | 0 | 0 | 3 | 18 |
| s_…_709 | coach | 30 | job(cron) | 13 | 0 | 0 | 0 | 0 | 14 |
| s_…_783 | coach | 24 | call | 10 | 10 | 0 | 0 | 4 | 18 |
| s_…_800 | coach | 23 | call | 10 | 4 | 0 | 0 | 1 | 17 |
| s_…_737 | tech-lead | 21 | call | 6 | 1 | 0 | 0 | 1 | 13 |
| s_…_773 | coach | 19 | job(cron) | 1 | 12 | 0 | 0 | 0 | 10 |
| **Totals** | 2 agents (coach×8, tech-lead×1) | **303** | — | **131** | **93** | **1** | **0** | **9** | **196** |

Excluded: coder 27/20-op sessions (verification-failure retries — orthogonal to tool-gap), bob 18-op (hypothesis wiring — non-repeat), optimizer self-sessions (Mode A/C at 40/28 ops already analyzed in prior findings).

## 2. Pattern frequency & threshold check

| Pattern | Occurrences | Agents | Qualifies? | Δ vs 03:00 UTC | Dispatch stance |
|---|---:|---:|---|---:|---|
| P1 ad-hoc `bun:sqlite` DB query | **131** | **coach×8, tech-lead×1** ✅ | **+44 / +51%** | **NO_DISPATCH — Mode A 00:30 patch covers ~70% (convention-regression); waiting for land** |
| P2 session.jsonl transcript inspect | **93** | **coach×6, tech-lead×1** ✅ | **+46 / +98%** | NO_DISPATCH — same coach-convention cohort driving both; no independent signal |
| P3 `grep/find/ls` code spelunking | 196 | coach×8, tech-lead×1 ✅ | flat | `code-search.ts` exists (9 uses, +3) — Level-4 adoption floor; no new dispatch |
| P4 `session-query` usage | 0 | 0 | — | still zero adoption, Level-4 |
| P5 `git-when.sh` | 1 | 1 | ❌ | flat at collapse | Mode D follow-up (watch-list) |
| P6 tsc/vitest inline (tech-lead) | 0 | 0 | — | Mode C 23:30 dispatch target; still clean |

## 3. Is the P1 rebound a *new* pattern?

**No.** Decomposition of the 131 P1 hits:

- **Coach convention-regression jobs** (766/767/813/854/709): 104 hits (79%). Shape is identical to the 00:30 UTC Mode A investigation — `convention_checks` table scan + `PRAGMA table_info` + fail-sample filtering + per-session jsonl read. Exactly the pathology that Mode A 00:30 dispatched `may/convention-check.ts` to eliminate.
- **Coach common-sense cron + reflect** (773/709): 14 hits. Exploratory; low volume; no repeated shape.
- **Coach scaffold work** (783/800): 20 hits. Convention-regression adjacent (amy/tech-lead C12.1).
- **Tech-lead IT-27 diagnosis** (737): 6 hits. One-off ENOENT drill-down.

The rebound is 100% coach convention-regression traffic — the thing Mode A already dispatched a fix for. Dispatching again stacks.

## 4. Why the Mode A 00:30 patch hasn't dented P1

Likely reasons (not verified this slot — next Mode D work):

1. **Dispatch accepted but code not merged** — check `agents/may/handlers/convention-check.ts` for the VERIFICATION_PATTERNS change.
2. **Coach work is already in flight** — convention-check fires the jobs; even if may/convention-check.ts changes behavior, the 4 coach investigations in this window (766/767/813/854) were spawned by earlier convention-check cron ticks, before any patch landed.
3. **New regressions (coder C1.1 80.7%, bob C12.1 87.5%) still firing** — task descriptions show convention-check was still triggering new coach investigations at 2026-04-18 03:00 UTC (854 started at ~03:29 UTC).

**Action**: do NOT re-dispatch — let Mode A patch land + run for one full cycle, then re-measure at next Mode B rotation.

## 5. Dedupe vs prior Mode B findings

| Prior finding | Pattern | Verdict | Status now |
|---|---|---|---|
| `finding-mode-b-tool-gap-20260418-0300.md` | P1=87, declining; NO_DISPATCH | held | **P1=131, rebounded — still coach-convention; NO_DISPATCH** |
| `finding-mode-b-tool-gap-20260418-0100.md` | P1=113, 6 agents; NO_DISPATCH | held | still held |
| `finding-tool-adoption-patterns-0412.md` | Level-4 = 0% adoption | — | Confirmed: session-query=0, code-search=9 (floor) |

## 6. KE-123 / KE-026 re-check

- **Mode A 00:30 UTC** (may/convention-check.ts bash-as-read patch) — touches ~79% of P1 volume. Not yet verified landed. **Primary blocker for any new P1 dispatch.**
- **Mode C 23:30 UTC** (tech-lead inline-diagnostic prompt tweak) — still in observation; tech-lead ops look clean (21 ops, 6 bun:sqlite in s_737 diagnosis — within envelope).
- Stacking any third intervention now violates KE-123 (2+ interventions = -12-15pp).
- Any new tool would land in Level-4 (context.md mention only) which per KE-026 = 0% adoption. `session-query` still at 0 uses confirms this ceiling.

## 7. Final verdict

- **R1 = NO_DISPATCH this slot.**
- **R2 = Watch-list:**
  - Verify Mode A 00:30 may/convention-check.ts patch status at next Mode D rotation.
  - Re-evaluate P1 at next Mode B rotation AFTER patch lands. If P1 drops below 40/6h, close watchlist; if it stays ≥80/6h without coach-convention volume, revisit Level-1 coach-handler proposal from 01:00 UTC finding §4.
  - `git-when.sh` collapse still flagged — carry to next Mode D.

## 8. Deliverables checklist

- [x] Sessions surveyed (§1)
- [x] Pattern frequency + threshold table (§2)
- [x] Rebound-attribution analysis (§3)
- [x] Mode A patch-status hypothesis (§4)
- [x] Dedupe vs prior Mode B findings (§5)
- [x] KE-123 / KE-026 re-check (§6)
- [x] R1/R2 decision (§7)
- [ ] todo.md rotation marker updated → next=C (pending)

**Budget**: ~7 ops used (within ≤25 cap).

[SIG: 1776488469:mode-b-0500-no-dispatch]
