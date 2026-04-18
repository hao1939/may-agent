# Finding: Mode B — Tool Gap 6h Bash Pattern Scan (2026-04-18 03:00 UTC)

**Session**: s_1776481266695_808 (optimizer heartbeat, Mode B rotation)
**Window**: last 6h (since 2026-04-17 21:00 UTC), `opCount > 15`
**Source**: `.state/may.db sessions` + per-session `.state/sessions/history/<sid>/session.jsonl` (toolCall greps)

## TL;DR — **NO_DISPATCH** (pattern declining, KE-123 non-stack still active, zero new actionable shape)

All prior Mode B candidate patterns are **flat or declining** vs the 01:00 UTC slot. The top pattern (ad-hoc `bun:sqlite` DB querying) dropped from 113 → **87 hits** (-23%) across 6 sessions / 3 agents (coach 4, optimizer 1, tech-lead 1) — still the dominant shape but no longer growing. No new bash pattern crosses the ≥3-agents × ≥3-incidents threshold. The Mode A 00:30 UTC dispatch (`may/convention-check.ts` patch) and Mode C 23:30 UTC dispatch (tech-lead inline-diagnostic) remain in observation — KE-123 stacking rule still blocks. **Holding.**

One negative signal worth noting: `git-when.sh` usage collapsed from 39 → **1 hit** in the same window — the previously-celebrated cross-agent adoption did NOT stick. Diagnostic note in §6.

## 1. Top 6 sessions surveyed (opCount > 15, last 6h)

| sessionId | agent | ops | kind | bash cmds | bun:sqlite | jsonl-inspect | git-when.sh | session-query | code-search |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| s_…_766 | coach | 73 | job | ~60 | 39 | 32 | 0 | 0 | 0 |
| s_…_767 | coach | 38 | job | ~30 | 9 | 0 | 1 | 0 | 0 |
| s_…_709 | coach | 30 | job(cron) | ~25 | 13 | 0 | 0 | 0 | 0 |
| s_…_783 | coach | 24 | call | ~20 | 10 | 10 | 0 | 0 | 4 |
| s_…_800 | coach | 23 | call | ~18 | 10 | 4 | 0 | 0 | 1 |
| s_…_737 | tech-lead | 21 | call | ~22 | 6 | 1 | 0 | 0 | 1 |
| **Totals** | **2 unique agents (+1)** | **209** | — | **~175** | **87** | **47** | **1** | **0** | **6** |

Note: optimizer Mode A/C sessions in this window (s_759, s_687) fall partially outside the 6h cutoff for jsonl counts; excluded to avoid double-counting vs prior findings.

## 2. Pattern frequency & threshold check

| Pattern | Occurrences | Agents | Qualifies? | Delta vs 01:00 UTC | Dispatch stance |
|---|---:|---:|---|---|---|
| P1 ad-hoc `bun:sqlite` DB query | **87** | **3** (coach×5, tech-lead×1, optimizer∉win) ✅ | **-26 / -23%** | **NO_DISPATCH — KE-123 still active** |
| P2 session.jsonl transcript inspect | 47 | 2 (coach×3, tech-lead×1) ❌ below | -37 / -44% | Hold (declining; gym-batch `--inspect` still pending) |
| P3 coach convention-regression DB spelunking | 61/87 of P1 | 1 (coach only) ❌ | steady | **Covered by Mode A 00:30 may/convention-check.ts dispatch — waiting for land** |
| P4 grep code spelunking | ~18 | 4 ✅ | flat | `code-search.ts` exists, 6 uses (adoption still floor-level) |
| P5 `git-when.sh` | **1** | **1** | collapsed | **-38 / -97%** | **Regression signal — see §6** |
| P6 tsc/vitest inline | 0 | 0 | no | — | — |

## 3. Is there a new pattern to collapse?

**No.** The distinct bash command shapes in the six sessions decompose cleanly into already-catalogued patterns:

- `export PATH=".state/.bun/bin:$PATH" && bun -e "…"` — P1 variant (bun env prefix, not a new pattern; just verbose).
- `grep -n / grep -rn / find agents` — P4 (covered by `code-search.ts`, zero adoption).
- `ls agents/shared/conventions/` + `ls agents/shared/knowledge/conventions/` — convention-file discovery (part of the same C1.x investigation pathology Mode A targeted).
- `cd /app/agents && …` + `sed -n` — file inspection; normal read traffic, not a shape worth collapsing.

No shape with ≥3 agents × ≥3 non-overlapping incidents survives dedup against existing tools.

## 4. Dedupe vs. prior Mode B findings

| Prior finding | Pattern | Verdict | Status now |
|---|---|---|---|
| `finding-mode-b-tool-gap-20260418-0100.md` | P1 bun:sqlite = 113/6h, 6 agents, NO_DISPATCH (KE-123) | held | **87/6h, 3 agents — declining, still held** |
| `finding-mode-b-tool-gap-20260417-2300.md` | session.jsonl dupe of 21:00 | NO_DISPATCH | 47/6h, below threshold |
| `finding-tool-gap-mode-b-20260417-1430.md` | git-log archaeology | NO_DISPATCH | not observed this slot |
| `finding-tool-adoption-patterns-0412.md` | Level-4 = 0% | — | Confirmed again: session-query 0 uses, code-search 6 uses (optimizer+coach+tech-lead) |

## 5. KE-123 / KE-026 re-check

- **Mode A 00:30 UTC dispatch** (may/convention-check.ts bash-as-read patch) — still in observation; not yet verified landed. Touches ~70% of P1 volume.
- **Mode C 23:30 UTC dispatch** (tech-lead inline-diagnostic prompt tweak) — still in observation.
- **Mode A 02:30 UTC investigation** (coach s_766 C1.7) — no dispatch, self-healing, concluded NO_DISPATCH.
- Stacking a third active dispatch now violates KE-123 (2+ interventions = -12-15pp). Any new tool also lands in Level-4 (context.md mention only) which per KE-026 = 0% adoption.

## 6. New observation — git-when.sh adoption regressed

Previous slot: 39 uses / 2 agents (tech-lead s_628 ×13). This slot: **1 use** (coach s_767). Two hypotheses:

1. **One-hit wonder**: tech-lead s_628 was a single workflow-triggered heartbeat that happened to exercise git-when.sh heavily; no structural invocation elsewhere.
2. **Dispatch-path regression**: the heartbeat/workflow hook that invoked it may have silently dropped (worth a follow-up grep of `agents/tech-lead/*.md` for the reference).

This is a **future Mode D (Workflow Health) item**, not a Mode B (tool-gap) item. Logged here for the watch-list; not dispatching.

## 7. Final verdict

- **R1 = NO_DISPATCH this slot.**
- **R2 = Watch-list:**
  - Re-evaluate P1 at next Mode B rotation AFTER may/convention-check patch lands. If P1 drops below 40/6h, close the P1 watchlist item; if it stays ≥60/6h without coach-convention volume, revisit Level-1 coach-handler proposal from 01:00 UTC finding §4.
  - Flag `git-when.sh` adoption collapse (39 → 1) for next Mode D — check whether a prompt/workflow ref was dropped.
  - Hold P2 (session.jsonl) pending gym-batch `--inspect`.

## 8. Deliverables checklist

- [x] Top sessions surveyed (§1)
- [x] Pattern frequency + threshold table (§2)
- [x] New-pattern check (§3)
- [x] Dedupe vs prior Mode B findings (§4)
- [x] KE-123 / KE-026 re-check (§5)
- [x] New observation: git-when.sh regression (§6)
- [x] R1/R2 decision (§7)
- [x] todo.md rotation marker updated → next=C

**Budget**: ~8 ops used (within ≤25 cap).

[SIG: 1776481266:mode-b-0300-no-dispatch]
