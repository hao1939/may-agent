# Finding: Mode B — Tool Gap 6h Bash Pattern Scan (2026-04-18 01:00 UTC)

**Session**: s_1776474067206_747 (optimizer heartbeat, Mode B rotation)
**Window**: last 6h (since 2026-04-17 19:00 UTC), `opCount ≥ 20`
**Source**: `.state/may.db sessions` + per-session `.state/sessions/history/<sid>/session.jsonl` (toolCall greps)

## TL;DR — **NO_DISPATCH** (KE-123 non-stack + KE-026 adoption ceiling)

New dominant pattern is **ad-hoc `bun -e "…bun:sqlite…"` DB querying**: **≈113 invocations across 6 agents × 6 sessions in 6h** (up from 2 agents × 14 in the 23:00 UTC slot — ~4× growth). This is the exact shape `scripts/session-query.ts` was built to collapse, but that tool only covers the `sessions` table; the new usage is dominated by `convention_checks`, `evaluations`, `requests`, and `gym_runs` tables that session-query doesn't support. Extending it is tempting but hits KE-026 (zero adoption of session-query and code-search outside optimizer) and KE-123 (Mode A dispatched a `may/convention-check.ts` patch ~30 min ago — same investigative space). **Holding.**

## 1. Top 6 sessions surveyed (opCount ≥ 20, last 6h)

| sessionId | agent | ops | bash | `bun -e` | `bun:sqlite` refs | jsonl-inspect | git-log | grep | git-when.sh | code-search | session-query |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| s_…_709 | coach (reflect cron) | 30 | 32 | 14 | 14 | 0 | 3 | 7 | 0 | 0 | 0 |
| s_…_577 | coach | 41 | 44 | 0* | 23 | 22 | 0 | 8 | 0 | 0 | 0 |
| s_…_664 | coach | 32 | 34 | 14 | 24 | 8 | 1 | 6 | 0 | 1 | 0 |
| s_…_574 | scout | 36 | 39 | 0* | 11 | 0 | 10 | 0 | 0 | 1 | 0 |
| s_…_617 | optimizer (Mode A) | 30 | 31 | 0* | 26 | 54 | 0 | 1 | 26 | 6 | 14 |
| s_…_628 | tech-lead (heartbeat) | 25 | 25 | 0* | 15 | 0 | 0 | 2 | 13 | 2 | 0 |
| **Totals** | **6 agents** | **194** | **205** | **28** | **113** | **84** | **14** | **24** | **39** | **10** | **14** |

\* `bun -e` count of 0 despite `bun:sqlite` hits = heredoc shape (`bun -e "$(cat <<'SCRIPT' ... SCRIPT)"`) — not caught by the naive `"command":"bun -e` prefix regex. Semantically identical.

## 2. Pattern frequency & threshold check (≥3 agents × ≥3 incidents)

| Pattern | Occurrences | Agents | Qualifies? | Existing coverage | Dispatch stance |
|---|---:|---:|---|---|---|
| **P1 ad-hoc `bun:sqlite` DB query** (bun -e / heredoc, schema-discovery + query chains) | **113** | **6** ✅ | **YES — new top pattern** | `session-query.ts` covers `sessions` table only; misses `convention_checks`, `evaluations`, `requests`, `gym_runs` | **NO_DISPATCH — see §3** |
| P2 session.jsonl transcript inspect | 84 | 3 (coach×2, optimizer×1) ✅ | yes | Pending gym-batch `--inspect` (still not landed per `ls scripts/`) | Hold (21:00 & 23:00 UTC findings) |
| P3 `git-when.sh` uses | 39 | 2 (optimizer, tech-lead) ❌ | below (2 agents) | Tool exists (`scripts/git-when.sh`, 173 LoC, landed `be8b7c7e`) | **Positive signal — first tool-gap dispatch this week to see non-optimizer adoption (tech-lead s_628: 13 calls)** |
| P4 grep code spelunking | 24 | 4 ✅ | yes | `scripts/code-search.ts` exists, ~0 adoption (10 uses, all by optimizer/tech-lead) | KE-026/KE-123 — adoption fix, not tool fix |
| P5 `git log` archaeology | 14 | 2 (scout s_574=10, coach s_709=3) | below | — | Watch-list (carried from 23:00) |
| P6 tsc+vitest | 0 | 0 | no | — | — |

## 3. Why NOT dispatch a `db-query` tool (or extend session-query) — the argument against the winner

The P1 pattern is real and 4× larger than last slot, but three compounding reasons say hold:

1. **KE-123 non-stack (hard block).** Mode A at 00:30 UTC just dispatched P1 to `may` to patch `may/handlers/convention-check.ts` (add bash-as-read + git/cat/grep VERIFICATION_PATTERNS). ~50% of the P1 volume in this window (coach s_577 + s_664 + s_709 ≈ 61 of 113 queries) is coach investigating convention_checks / C1.1 regressions — **exactly the pathology Mode A's fix targets**. If the may patch lands, coach's convention_checks spelunking collapses and P1 shrinks below threshold without a new tool.
2. **KE-026 / Level-4 adoption ceiling.** `session-query.ts` has 14 uses in 6h, **all in one optimizer session (s_617) — still zero cross-agent adoption**. `code-search.ts` has 10 uses, 6 optimizer + 2 tech-lead + 1 coach + 1 scout — finally non-zero but trivial. Building a third query CLI that lives in `scripts/` and gets mentioned in `context.md` is Level-4 adoption; per `finding-tool-adoption-patterns-0412.md`, Level-4 → 0%. The right fix for ad-hoc DB querying is **prebuilt queries baked into handlers** (Level-1), not another CLI.
3. **Positive counter-signal: git-when.sh is being adopted.** The Apr 17 ~19:00 UTC dispatch of `scripts/git-when.sh` shows **39 uses across optimizer + tech-lead in 6h**, including tech-lead `s_628` using it 13 times in a single heartbeat. This is the first real cross-agent adoption of an optimizer-dispatched tool this month, and it happened because tech-lead's heartbeat.md was wired to dispatch it structurally (not just context.md mention). Let that land stably for 24h before adding another tool — measuring git-when.sh's full adoption arc is higher-value than shipping a second script into the same channel.

## 4. Candidate sketch (held, not dispatched)

If P1 persists after the may/convention-check patch lands (check at 06:00 UTC), the right form is **NOT** a generic `db-query` CLI. Instead:

- **Level-1 fix**: add `agents/coach/handlers/convention-regression-brief.ts` that runs the canonical coach investigation query bundle (7d vs 14d pass rate, last-30 failures with violation text, linked session/task) in one handler call, called via cron or notify. Eliminates coach-side bun:sqlite heredocs entirely.
- **Level-3 fork**: extend `session-query.ts` with `--table convention_checks|evaluations|requests|gym_runs` pass-through + a `--schema` flag. Small (~60 LoC diff) — but only worthwhile if Level-1 handler proves insufficient.

Both parked as queued work items; dispatching neither now.

## 5. Dedupe vs. prior Mode B findings

| Prior finding | Pattern | Verdict | Status now |
|---|---|---|---|
| `finding-mode-b-tool-gap-20260417-2300.md` | P6 bun:sqlite = 14/6h, 2 agents, below threshold | below threshold | **Now 113/6h, 6 agents — escalated, but overridden by KE-123 stack with Mode A 00:30 UTC dispatch** |
| `finding-tool-gap-mode-b-0417-3.md` (21:00) | P1 session.jsonl inspect | NO_DISPATCH pending gym-batch --inspect | still pending; no new evidence to re-escalate |
| `finding-tool-gap-mode-b-0417.md` (19:00) | gym-trial transcript | **DISPATCHED** → `git-when.sh` landed (`be8b7c7e`) | **adopted: 39 uses / 6h / 2 agents** ✅ |
| `finding-tool-adoption-patterns-0412.md` | Level-4 = 0% adoption | — | Confirmed again: session-query still 0% cross-agent |

## 6. Final verdict

- **R1 = NO_DISPATCH this slot.**
- **R2 = Watch-list:**
  - Re-evaluate P1 at next Mode B rotation (06:00 UTC) AFTER may/convention-check patch lands. If P1 stays ≥80/6h across ≥4 agents with coach-convention investigation removed, escalate Level-1 coach handler proposal.
  - Monitor `git-when.sh` adoption over 24h — if it sustains ≥30/6h across ≥2 non-optimizer agents, document the adoption playbook (`finding-tool-adoption-playbook.md`) for reuse on future dispatches. This is the first successful cross-agent tool adoption in 30+ days.
  - Hold P2 (session.jsonl) pending gym-batch `--inspect` — unchanged.

## 7. Deliverables checklist

- [x] Top 6 sessions surveyed (§1)
- [x] Pattern frequency + threshold table (§2)
- [x] Dispatch-candidate analysis with counter-reasons (§3)
- [x] Held-candidate sketch (§4)
- [x] Dedupe vs prior Mode B findings (§5)
- [x] R1/R2 decision (§6)
- [x] todo.md rotation marker updated → next=C

**Budget**: ~11 ops used (within ≤25 cap).

[SIG: 1776474067:mode-b-0100-no-dispatch]
