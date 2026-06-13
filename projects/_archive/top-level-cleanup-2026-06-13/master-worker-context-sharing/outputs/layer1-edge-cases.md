# Layer-1 Envelope — Edge Case Stress Test

The envelope must handle:
1. Multiple invocation origins (human, handler/cron, parent-agent fork)
2. Multi-turn user inputs (corrections, follow-ups)
3. Genuinely trivial tasks (the envelope must not be ceremony)
4. Validation gate edge cases (when does the gate reject? false positives?)
5. Tool re-use during a session (`new_session: true` semantics)
6. cc/codex differ in capabilities — does the same envelope serve both?

## Edge case 1 — Heartbeat-launched master (no human in the loop)

Setup: cron triggers master with task `"heartbeat: review your active projects, escalate stalls"`.

**Envelope decision**: `user_task` is the wrong name. Rename to `originator_task`.
Add `originator_kind: "human" | "handler" | "parent_agent"`.
Add `originator_id` (e.g., handler name or parent session ID).

When `originator_kind == "handler"`, the verbatim rule applies to the handler's literal task string.

**Validation gate**: should NOT require a human-like utterance. Should require `originator_task.length > 0`.

**Verdict**: ✅ fixable by widening the schema. Add to spec.

---

## Edge case 2 — User correction mid-session

Setup:
- Turn 1: user says "do X"
- Master delegates badly.
- Turn 2: user says "you misread; X means Y."

Envelope question: what's `originator_task` on the *next* worker call?

**Three candidate semantics**:
- **(a) "Latest user msg"** = "you misread; X means Y." → cc has no idea what X is.
- **(b) "Original user msg"** = "do X" → cc has no idea about the correction.
- **(c) "Concatenated"** = "Original: do X | Correction: X means Y" → cc sees both. Verbose but complete.

(c) is correct. Spec: `originator_task` always holds the *originating* instruction; corrections go into a new field `corrections: string[]` (latest-last). cc sees both.

**Validation gate**: when a new user message arrives, master must either (a) add to `corrections`, or (b) treat this as a *new* originating task (resets `corrections`). The gate cannot tell which; master decides. So no enforcement here, just spec.

**Verdict**: ✅ fixable with one new field. Spec it.

---

## Edge case 3 — Trivial task (`"cat /tmp/foo.log"`)

The 4-block envelope is wrong shape. But carving out an exception ("if task is trivial, skip the envelope") opens a hole: master will classify everything as trivial.

**Better approach**: keep the envelope, but allow `ask.kind: "quick_read"` with relaxed requirements:
- `context.pinned_files` not required (cc can decide what to read)
- `return.sections` not required (free-form text OK)
- But `originator_task` still required (so even quick reads carry user intent).

This means the envelope is always 4 blocks, but two are sometimes near-empty. Lower ceremony cost than full-blown envelope, no escape from `originator_task`.

**Verdict**: ✅ spec a `quick_read` ask kind. Token cost ≈ +80 bytes vs raw prompt — acceptable.

---

## Edge case 4 — Validation gate false positives

The gate rejects calls where (e.g.) `originator_task` doesn't contain ≥80% token overlap with the last user message. False positives:

- **Multi-turn refinements** (edge case 2 above): after correction, user message is short; overlap check fails because user message is now "no, Y not X." → False positive.
- **Master legitimately initiates** (e.g., heartbeat-driven): no user msg at all. → False positive unless we special-case `originator_kind != human`.
- **Parent-agent fork**: parent gives master a task; the "user msg" is the parent's instruction, not a human's. → False positive unless gate accepts originator-string match instead.

**Resolution**: validation gate checks `originator_task` matches the *last originating event* (could be: latest human msg, the handler's task string, or the parent agent's fork instruction), not "the last user msg" specifically.

**Implementation**: master's tool wrapper has access to its own session metadata (`meta.json` knows `agent`, `task`, `source: "human"|"job"|...`). The gate cross-references.

**Verdict**: ⚠️ implementable but **adds coupling** between the tool and master's session infrastructure. Tradeoff: looser gate (just check non-empty) or tighter gate (with the coupling). Recommendation: **start loose, tighten after seeing real failure modes**. Gate v1 = `originator_task.length > 10`. Iterate.

---

## Edge case 5 — `new_session: true` semantics

Current `cc_worker` resumes the same cc session across calls. If master sends a fresh `originator_task` after `new_session: true`, the *cc session* has no memory but the *envelope* still carries the originator_task — correct. No problem.

But: if master *doesn't* set `new_session: true` and the prior session was on a different task, cc has stale context. The envelope can't fix this — it's a runtime issue.

**Mitigation**: include a `session_recap` field in the *return* envelope (Layer 5 of original design). Master sees cc's accumulated memory and can decide whether to start fresh.

**Verdict**: ✅ already addressed by Layer 5. Cross-references are consistent.

---

## Edge case 6 — Same envelope for cc and codex?

cc and codex have different streaming protocols (cc = stream-json, codex = different JSON shape). Layer 2 (parser) is cc-specific. Codex needs its own parser. But the *envelope* (Layer 1, input shape) is identical — it's just structured fields. Both workers receive the same envelope; their wrappers translate it into the worker-specific prompt format.

**Verdict**: ✅ envelope is worker-agnostic. Parsers are worker-specific. No problem.

---

## Edge case 7 — Master legitimately wants cc to explore freely

Sometimes the right ask is "go figure out what's broken." `ask.deliverable` = "diagnosis" is fine, but `success_criteria` is hard to pre-state ("I'll know it when I see it").

**Resolution**: `success_criteria` can be soft ("a credible-looking diagnosis with evidence"). The validation gate only checks non-empty, not semantic quality.

**Verdict**: ✅ no schema change. Just don't over-strict the gate.

---

## Edge case 8 — Cycles / re-delegation

cc might internally use Task/sub-agent (we saw `subtype: "task_started"` in real CC logs). cc's sub-agent doesn't see the envelope — only cc's prompt to it. So context-to-grand-child is cc's responsibility, not ours.

**Verdict**: ✅ out of scope. Document as a known limit.

---

## Edge case 9 — Envelope ignored (validation off)

What if the gate is disabled (env flag) for testing, and master sends a freeform prompt? The new `cc_worker` wrapper must still accept it somehow, or master breaks.

**Resolution**: tool accepts EITHER envelope fields OR a legacy `prompt` string. Legacy mode logs a deprecation warning + a metric (`master.envelope.legacy-fallback`). After a soak period, hard-deprecate.

**Verdict**: ✅ standard migration pattern.

---

## Edge case 10 — Master loses the envelope mid-thought

Token budget pressure: master's own context is compacting; the envelope rule might evaporate from the system prompt over many turns.

**Mitigation**: AGENTS.md schema (Layer 4) is in the *system* prompt slot, which most agent runtimes keep stable across compaction. KE-377 (schema organized context) findings imply position + structure dominate. The hard rule should sit in `[WHEN DELEGATING…]` near the top.

**Verdict**: ✅ addressed by Layer 4's structure. Worth verifying with a long-session probe later.

---

## Summary table

| # | Edge case | Resolution | Status |
|---|---|---|---|
| 1 | Heartbeat/cron origin | Rename `user_task` → `originator_task` + `originator_kind` | ✅ spec |
| 2 | Multi-turn corrections | Keep originator stable; add `corrections: string[]` | ✅ spec |
| 3 | Trivial tasks | Add `ask.kind: "quick_read"` with relaxed required fields | ✅ spec |
| 4 | Validation false positives | Gate v1 = `non-empty + length>10` only; tighten after data | ⚠️ start loose |
| 5 | new_session semantics | Layer 5 (session_recap) covers it | ✅ consistent |
| 6 | cc vs codex | Envelope worker-agnostic; parsers worker-specific | ✅ no change |
| 7 | Open-ended exploration | Soft success_criteria allowed | ✅ no change |
| 8 | cc internal sub-agents | Out of scope | ✅ documented |
| 9 | Legacy fallback during migration | Accept legacy `prompt`; metric + warn | ✅ spec |
| 10 | Schema rule evaporating in long sessions | System-prompt position; Layer-4 schema | ✅ likely |

## Design changes required from this stress test

1. **Rename** `user_task` → `originator_task`. Add `originator_kind` and `originator_id`.
2. **Add** `corrections: string[]` for multi-turn refinements.
3. **Add** `ask.kind: "quick_read"` with relaxed envelope.
4. **Start** validation gate loose (non-empty + length>10), tighten by data.
5. **Accept** legacy `prompt` string with deprecation warning during migration.
6. **Document** cc's internal sub-agents as out-of-scope.

## Real concerns this surfaced

- **Validation-gate strictness is the hardest call.** Too loose = master will revert to bare prompts and gate is theater. Too tight = false positives break legitimate workflows. The audit in step B showed master *already* writes 38% concept-coverage prompts on average — so a gate requiring 80% overlap would reject half of master's current calls, including ones that *worked*. Honest answer: **the gate's threshold is a tuning parameter**, not a constant. We should A/B test thresholds and measure both false-positive rate and frame-collapse prevention.
- **The envelope itself is uncontentious.** All 10 edge cases resolved with small additions, not redesigns. That's evidence the basic shape is sound.
- **My biggest worry**: this whole spec assumes master *uses* the envelope. Without runtime enforcement at the tool boundary, this is the same kind of prose-rule that AGENTS.md already had and master ignored. The validation gate is the only thing that makes the envelope real.
