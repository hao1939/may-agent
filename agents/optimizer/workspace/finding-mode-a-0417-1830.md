# Mode A: Session Archaeology — 2026-04-17 ~18:30 UTC

**Window**: last 6h, `opCount > 70` (2 sessions).

---

## Session 1: coach 76-op — Weekly promoted-skill regression check

- **Session ID**: `s_1776444880857_502`
- **Agent**: coach
- **Task**: Weekly promoted-skill gym regression check (3 skills).
- **Duration**: 9m22s (1776444880858 → 1776445443582).
- **Outcome**: `finish(status:"blocked")` — gym runner infra broken by unrelated `VALID_TOOL_PRESETS` regression.
- **By-tool counts**: bash 76, read 5, write 1, edit 1, agents 1, finish 1 (total 85).
- **Max consecutive-bash streak**: **36** (!); other streaks: 19, 11, 7. Streak ≥3 accounts for 73/76 bash calls.

### Top-5 tool-call signatures (coach)
All 76 bash commands were unique (no exact duplicates), so the signature is the *class* of command:

| # | Class | Count | Examples |
|---|-------|-------|----------|
| 1 | gym-runner invocation (gym-run.sh / gym-batch.sh / bundle/may-agent --oneshot) | **19** | `scripts/gym-run.sh efficient-file-reading --agent coder`, `MAY_BIN=/usr/local/bin/may-agent scripts/gym-run.sh …` |
| 2 | binary-divergence probing (md5sum / stat / ls -la on `/usr/local/bin/may-agent` vs `/app/bundle/may-agent`) | **10** | `md5sum /usr/local/bin/may-agent /app/bundle/may-agent`, `stat … grep -E "File\|Inode\|Modify"` |
| 3 | agent-loader grep archaeology (`grep -n "cite-source\|\"notify\"" src/…`, `git show … src/app/agent-loader.ts`) | **13** | `grep -rn "cite-source\|citeSource\|\"notify\""`, `git show d15c5249 -- src/app/agent-loader.ts` |
| 4 | env/config inspection (`grep -n "AGENTS_ROOT\|loadAgents\|buildTools\|VALID_TOOL_PRESETS" …`, `ls .state/instances/`) | **12** | `grep -n "loadAgentConfig\|extends\|_archetypes" src/app/agent-loader.ts` |
| 5 | `/tmp/gym-run-*` artifact inspection (`ls`, `find`, `cat results.jsonl`) | **5** | `ls /tmp/gym-run-hyrspq/`, `find /tmp/gym-run-hyrspq -type f` |

Read-2+: `test/gym/gym-runner.ts` (×2), `src/app/may.ts` (×2).

### Dominant waste pattern (coach)

**Pre-flight env validation gap → broken-env rabbit hole (36-call consecutive bash spiral).**

Timeline:
- Ops 1–12 (~16% productive): legitimate discovery — locate scenarios, try gym-batch, try gym-run. Everything silently returns empty/error.
- Ops 13–76 (~84%): debugging *why* gym-runner fails. The gym runner’s failure mode was **silent** — `scripts/gym-run.sh` completed without a clear error; the bundle ran `--oneshot` and printed nothing actionable. Coach then:
  - rebuilt bundle (op 13, 63)
  - diffed `/app/bundle/may-agent` vs `/usr/local/bin/may-agent` (ops 44, 54, 73)
  - git-archaeologied `agent-loader.ts` (ops 60, 62, 64–72, 76)
  - spawned isolated STATE_DIR runs to reproduce (ops 50, 75)
  - eventually found: `VALID_TOOL_PRESETS` on HEAD is missing `cite-source`/`notify`; `--console` flag exposed *"Loaded 0 agent(s) — Unknown tool preset"* (op 53). Coach reported **blocked** with a solid diagnosis + dispatched P1 to may.

The session is **not pure waste** — coach surfaced a real P1 infra regression and escalated correctly. But the *pattern* is the same failure mode previously observed:

> **Cross-ref todo.md line 31 (EXP-144, Apr 12):**
> *"pre-flight env validation (saves 20-40 ops when envs are broken, ~25% of gym sessions)"*

This is the **2nd confirmed occurrence** of the broken-gym-env debug spiral since that finding was filed. The spiral was 50+ ops (13 → 53 before `--console` flag exposed the root error). With a pre-flight validator in `scripts/gym-run.sh` that runs `may-agent --list-agents 2>&1` and aborts with the captured "Loaded 0 agent(s)" / "Unknown tool preset" lines before even trying a scenario, this entire spiral collapses to ~5 ops.

### Fix recommendation (coach)

**Matches existing todo.md item** → line 31 ("pre-flight env validation"). No new pattern.

Concrete spec (refinement of existing idea):
- Add `--preflight` (or make default) to `scripts/gym-run.sh` and `scripts/gym-batch.sh`: before spawning any scenario, run `"$MAY_BIN" --console --oneshot --agent "$AGENT" --task "preflight" --timeout 1 2>&1 | head -20` and grep for `"Loaded 0 agent"` / `"Unknown tool preset"` / `"not registered"`. If any match, print *"GYM PREFLIGHT FAIL: <first error line>. Aborting. Fix agent-loader before running scenarios."* and exit 2.
- Target file: `scripts/gym-run.sh` (add preflight function, ~15 lines); `scripts/gym-batch.sh` (call once before trial loop, ~3 lines).
- Expected saving: 40+ ops on the ~25% of gym sessions where the env is broken. At current gym volume (10–14 coach/coder gym sessions/day) → **~100–140 ops/day** when a regression lands.

### Dispatch decision (coach finding)

**No dispatch this cycle (defer).** Rationale:
1. **KE-123 anti-stacking**: a tech-lead dispatch from Mode B landed Apr 17 17:40 (`gym-batch --inspect`, commit `c6f79c8c`). Mode D today already deferred per KE-123. A third gym-script dispatch in the same 6h window violates the one-intervention-per-cycle rule.
2. **Duplicate-observation threshold not reached for P1**: Apr 12 finding + this session = 2 occurrences. Policy in other findings is **3rd occurrence triggers promote-to-P1**. Logging this as the 2nd; next occurrence gets dispatched.
3. **Root cause already being fixed by may**: coach’s blocked-finish already dispatched a P1 repair request for the underlying `VALID_TOOL_PRESETS` regression. Fixing the root symptom reduces pre-flight-fix urgency.

Action: record 2nd occurrence in todo.md observation bullet; set trigger for dispatch on next recurrence.

---

## Session 2: tech-lead 74-op — Split `agents.message` into `notify` tool

- **Session ID**: `s_1776442914838_479`
- **Agent**: tech-lead
- **Task**: P0 refactor — split `agents.message` into a separate `notify` tool (10+ files).
- **Duration**: 13m45s (1776442914839 → 1776443740050).
- **Outcome**: `finish(status:"success")` — refactor landed; `notify` tool wired; tsc clean; 1989 tests passed, 2 pre-existing unrelated failures.
- **By-tool counts**: bash 56, edit 20, read 13, write 1, finish 1 (total 91).
- **Max consecutive-bash streak**: 12 (during vitest loop); other streaks: 6, 5, 5, 5, 5, 4, 4. Mostly healthy 4–6.

### Top-5 tool-call signatures (tech-lead)

| # | Signature | Count |
|---|-----------|-------|
| 1 | `edit: src/lib/manager-agents-tool.ts` | 6 |
| 2 | `edit: src/app/agent-loader.ts` | 4 |
| 3 | `read: src/lib/manager-agents-tool.ts` | 3 |
| 4 | `bash: tsc --noEmit` (typecheck loop) | 2 (+ 1 final) |
| 5 | `read: src/lib/tools/send-tool.ts`, `read: src/app/agent-loader.ts`, `edit: test/agents-tool.test.ts` each ×2 | 2 each |

### Dominant waste pattern (tech-lead)

**None material.** The spec required editing ≥10 files; session touched 10 (send-tool, manager-agents-tool, requests, handler-context, session-subscribers, cron, system-status, auto-pause, manager, db-writer) + 3 tests + sync-tools-md scripts. 20 edits / 10 unique files ≈ 2 edits/file average — in line with iterative tsc feedback. The 12-call bash streak (ops 70–78) was the standard vitest loop (run suite → grep failures → fix → re-run) and recovered three failing tests.

Healthy signals:
- Sequential reads before edits (C1.1 compliant).
- Tsc/vitest used as verification, not blind fuzzing.
- Only 2 reads per file — no cache-miss duplicate-read pattern (KE-140).
- Max streak 12 is *just at* the "bloated-session" threshold but happened during a legitimate test-fix loop, not discovery.

### Fix recommendation (tech-lead)

**N/A.** This is a correctly-sized 10-file refactor delivered in 91 tool calls. No dispatchable fix.

---

## Summary

| Session | Agent | Ops | Pattern | Actionable? |
|---|---|---|---|---|
| `s_1776444880857_502` | coach | 76 | Broken-gym-env debug spiral (36-call bash streak). 2nd occurrence of Apr 12 EXP-144 pattern. | **Defer** — hold per KE-123 + 3rd-occurrence rule. |
| `s_1776442914838_479` | tech-lead | 74 | Standard 10-file refactor with tsc/vitest loops. | **No** — healthy session. |

## Dispatch decision (overall)

**No dispatch this cycle.** Coach finding logged as 2nd-occurrence observation; tech-lead finding is a healthy high-op session (refactor scope, not waste). Both are escalation-free per KE-123.
