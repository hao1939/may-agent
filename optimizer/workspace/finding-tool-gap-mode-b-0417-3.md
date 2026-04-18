# Finding: Tool Gap Mode B — Host Transcript Inspection (6h) — NO_DISPATCH

**Date**: 2026-04-17 ~21:00 UTC
**Session**: s_1776459663269_630 (Mode B rotation)
**Filename note**: Task asked for `-0417-2.md` but that slot was taken by the 19:00 UTC git-when dispatch finding. Saved as `-3` to avoid clobbering.
**Method**: Queried `sessions` for last-6h opCount≥20 (12 sessions). Parsed `session.jsonl` for 11 with bun heuristics, extracted every `bash` toolCall, and counted commands touching `.state/sessions/history/*/session.jsonl` (the host-side transcript inspection pattern).
**Prior work**:
- [finding-tool-gap-mode-b-0417.md](finding-tool-gap-mode-b-0417.md) — **gym-trial** transcript inspection (`/tmp/gym-run-*`), dispatched to tech-lead as `gym-batch.sh --inspect`.
- [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md), [finding-tool-adoption-patterns-0412.md](finding-tool-adoption-patterns-0412.md) — 5-level adoption hierarchy; context.md mentions ≈ 0% adoption.
- `scripts/session-query.ts` already exists (built by optimizer Apr 11) but does **metadata** queries only (agent/opCount/status) — not transcript content. Still zero adoption beyond optimizer.

---

## Executive Summary

**One recurring pattern; NO new dispatch recommended.**

Agents investigating other sessions (archaeology / regression checks / QA triage) keep re-inventing a `session.jsonl` parser inline. In the last 6h, **9 of 11 deep-inspected sessions** touched `.state/sessions/history/*/session.jsonl` via bash, averaging ~8 such calls each (~72 ops/6h ≈ **~290 ops/day, $14/day** if extrapolated).

However, **this is the host-side analogue of the gym-transcript pattern already dispatched 4h ago**, and solving it via a new tool has the same adoption problem that sank `session-query.ts`. Per KE-123 (don't stack interventions) and KE-026 (pull-model discovery dead), I'm holding. Re-evaluate in 48h after the `gym-batch.sh --inspect` landing — if coach/optimizer naturally generalize a transcript-parser helper during that work, co-opt it; otherwise the real fix is Level-1/2 (bake into handler code).

## 1. Pattern & Evidence

Bash calls hitting `session.jsonl` or `.state/sessions/history/s_*`, per session (last 6h, opCount≥20):

| session | agent | total bash | jsonl-inspect | example |
|---|---|---:|---:|---|
| s_1776451760999_560 | coach | 63 | **18** | `tail -50 …/session.jsonl \| bun -e '...lines.slice(-15)...'` |
| s_1776447122744_525 | coder | 25 | 12 | `head -3 …/session.jsonl \| python3 -c "import json,sys..."` |
| s_1776453558249_577 | coach | 44 | 11 | `python3 << 'EOF' ... for c in o.get('content',[]): if c.get('type')=='toolCall': ... EOF` |
| s_1776450694782_552 | optimizer | 14 | 11 | `bun -e "const fs=require('fs'); const lines=fs.readFileSync('$F'...).split('\\n')..."` |
| s_1776438406509_433 | may | 21 | 9 | `tail -c 2000 …/session.jsonl` + `grep -oE '"stopReason":"[^"]+"\|...'` |
| s_1776443232956_487 | may | 26 | 8 | `python3 -c "...c.find('Injected: metrics')..."` |
| s_1776441294847_464 | coach | 39 | 7 | `grep -oE '"stopReason"\|"errorMessage"\|finish\(\) blocked'` |
| s_1776454248498_585 | qa | 23 | 5 | `find …/output -maxdepth 2` |
| s_1776447069499_524 | optimizer | 28 | 4 | `grep -o '"name":"[a-z_]*"' $f \| sort \| uniq -c` |

**Shape**: each session writes its own inline JSONL parser (python3 heredoc ×3 sessions, bun -e ×3 sessions, raw grep+sed ×3 sessions). The fields they pluck are a small closed set:
- `role:'assistant'` tool-use names + first-arg summary (`path`/`command`/`action`) — 6/9 sessions
- `finish` args / `stopReason` / `errorMessage` — 4/9 sessions
- last N tool calls before end (session tail) — 5/9 sessions
- agent-injected user content (`Injected: metrics`, `active_recall`, etc.) — 2/9 sessions

Field set is **identical to** §3 of [finding-tool-gap-mode-b-0417.md](finding-tool-gap-mode-b-0417.md) for gym trials.

## 2. Why NO_DISPATCH

| Reason | Detail |
|---|---|
| **Overlap with fresh dispatch** | `gym-batch.sh --inspect` was dispatched to tech-lead 4h ago and covers the exact same parsing logic (different input path). If it lands, the helper `scripts/inspect-session-jsonl.ts` proposed there **already operates on any `session.jsonl`** — the host directory is a trivial second caller. Adding a separate CLI now forks the work. |
| **Adoption ceiling** | `scripts/session-query.ts` is the nearest-analog existing tool and has **zero adoption** outside optimizer despite being in context.md (Apr 11→17, 6 days, no uptake). New CLI at Level 4 (context.md mention) = 0% adoption per [0412 finding](finding-tool-adoption-patterns-0412.md). |
| **KE-123** | Stacking a second behavioral/tool intervention on the same surface (session archaeology) in the same day degrades uptake by 12–15pp. Let the gym-batch --inspect ship and measure first. |
| **KE-026** | Pull-model discovery is dead. The callers here are mostly **free-form heartbeat/investigation** work — no structural dispatch template to wire a new tool into. |
| **Real fix is Level 1/2** | The biggest caller (coach s_560, 18 inspections, scout C1.7 regression) is doing what `agents/may/handlers/convention-check.ts` already does internally (line 373: reads `sessions/history/<sid>/session.jsonl` to extract `finish()` result). The convention-check handler **already has a reusable parser** — exporting it as `src/lib/session-transcript.ts` and letting handlers + CLI scripts import it is the Level-1 fix. That's a refactor, not a new tool. |

## 3. What To Do Instead (lightweight)

**Not dispatching anything now.** Two opportunistic follow-ups, queued in todo.md for next Mode B rotation:

1. **Re-evaluate in 48h** once `gym-batch.sh --inspect` lands. If tech-lead's helper is well-factored, propose pointing host-archaeology callers at the same helper (one-line docs edit in `agents/optimizer/workspace/` + optional `scripts/session-inspect.sh` wrapper). Cost: tiny.
2. **Longer horizon**: if the host-inspect pattern persists past the gym-batch landing, file a Level-1 proposal to extract the transcript parser from `agents/may/handlers/convention-check.ts:373` into a shared library — then add a thin CLI. This is the structurally correct fix but needs a willing refactorer (tech-lead's plate is full with the 74-op notify refactor).

## 4. Quantification / Sanity Check

- 9 sessions × ~8 jsonl-inspect bashes/6h = 72 ops/6h. Linear 24h ≈ 288 ops/day.
- At $0.05/op → $14/day, $420/month. Real but **not catastrophic**, and likely to partially self-mitigate once agents copy whatever pattern the gym-batch helper establishes.
- Coach dominates (s_560 + s_577 + s_464 = 36/72 = 50% of all inspect bashes). If one agent, one fix would do more than a general tool: **better coach heartbeat template telling it to call `agents.requests(filter:'all')` + sessionId DB query instead of regressing to transcript grep**. Parking this as a Mode A candidate for the next archaeology rotation.

## 5. Decision

**NO_DISPATCH.** Overlap with 0417 gym-transcript dispatch + zero-adoption precedent of session-query.ts + KE-123 + KE-026 all point the same way. Will revisit 2026-04-19 after gym-batch --inspect is deployed and measurable.

---

**Budget**: 18 ops used (within ≤25 cap).

[SIG: 1776459890:b-mode-no-dispatch]
