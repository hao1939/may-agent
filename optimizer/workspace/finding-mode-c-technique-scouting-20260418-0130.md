# Mode C — Skill & Technique Scouting: High-vs-Low-Op Session Comparison (6h)

**Window:** 2026-04-17T19:30Z → 2026-04-18T01:30Z
**Method:** `bun:sqlite` over `.state/may.db` sessions table, then transcript extraction via regex over `.state/sessions/history/<sid>/session.jsonl` (bash command strings).
**Author:** optimizer (session s_1776475866053_759)

## TL;DR
Low-op work sessions from the same agents **open with a read of the prior finding / prior output** (anchoring scope to known state) before touching the DB. High-op work sessions **open with exploratory discovery** (path hunting, schema re-probing, speculative `ls`/`find` chains) and only later consult prior state. The anchoring step costs 1-2 calls but prevents 5-15 calls of rediscovery. **R1 = NO_DISPATCH (KE-123 / Level-4 ceiling).** Reasoning in §5.

## 1. Cohort

High-op (top 3 by opCount, 6h window):
| sessionId | agent | ops | bash | task |
|---|---|---|---|---|
| s_1776454348114_587 | optimizer | 34 | 35 | Mode C — high-vs-low productivity sessions |
| s_1776464362791_664 | coach     | 32 | 34 | Investigate may C1.1 97%→92% regression |
| s_1776457872739_617 | optimizer | 30 | 31 | Mode A — 6h high-op dig |

Low-op non-heartbeat from same agents (opCount>0, task NOT LIKE '%heartbeat%'):
| sessionId | agent | ops | bash | task |
|---|---|---|---|---|
| s_1776470467340_714 | optimizer | 8  | 6  | Mode D — workflow health |
| s_1776456067138_602 | optimizer | 13 | 11 | Mode D — workflow health |
| s_1776457531898_610 | coach     | 21 | 21 | Promoted-skill regression check (weekly) |

## 2. First-Bash Divergence (the signal)

I extracted the first 6 bash commands from each transcript. The first bash predicts the rest.

**Low-op 714 (8 ops, optimizer Mode D):**
```
#1 cat agents/optimizer/workspace/todo.md ... && ls agents/optimizer/workspace/finding-mode-d*
#2 cat agents/optimizer/workspace/finding-mode-d-workflow-health-20260417-2200.md | head -80
#3 bun:sqlite — 6h SELECT agent, count, avg(opCount)…
#4 bun:sqlite — session-detail follow-up
```
→ Reads the previous Mode D finding first; builds the new query as a delta. Finished in 6 bash + 2 writes + finish.

**Low-op 602 (13 ops, optimizer Mode D):**
```
#1 ls agents/optimizer/workspace/ | grep -E "workflow|todo"
#2 cat finding-workflow-health-0417.md | head -80
#3-6 bun:sqlite (4 escalating heredocs — repeated re-runs, avoidable waste)
```
→ Same anchoring pattern, but then loses 3 calls to heredoc quoting flails (FM-2.2 — matches my own recalled failure mode).

**High-op 587 (34 ops, optimizer Mode C):**
```
#1 cat todo.md | head; ls agents/shared/knowledge/skills/ (empty)
#2 ls agents/shared/knowledge/skills/; ls skills/
#3 find . -type d -name skills
#4 ls skills/; find . -name "deliverable-checklist.md"
#5 ls agents/optimizer/skills/; ls agents/shared/; find agents -name skills
#6 ls agents/shared/skills/; ls agents/shared/knowledge/skills/
```
→ **Six sequential bash calls** hunting for the skills directory. The prior Mode C finding (23:30 UTC) would have mentioned the correct path; it was never read. Then 25+ more bash calls for the actual analysis.

**High-op 617 (30 ops, optimizer Mode A):**
```
#1 ls workspace/ | head -30 && cat todo.md | head -80       (anchoring ✓)
#2 bun:sqlite top high-op sessions (no PRAGMA)
#3 bun:sqlite session details (column guess)
#4 bun:sqlite PRAGMA (recovery after column guess)
#5 ls .state/sessions/                                       ← path guess
#6 ls .state/sessions/s_1776444880857_502/   (cannot access)
#7 find .state/sessions -name ...                            ← recovery
#8 ls .state/sessions/history/<sid>/                         ← correct path found
```
→ Anchoring present but shallow; lost **3 calls to the `.state/sessions/` vs `.state/sessions/history/` path gotcha**, then 3 more to `jq` pattern failures (jsonl has `type:"toolCall"` not `tool`). I hit the same path gotcha in the current session (call #5, pivot-required warning) — this is a recurring optimizer-archaeology waste.

**High-op 664 (32 ops, coach may-C1.1 regression):**
Twelve sequential `bun:sqlite` drill-downs: daily pass-rate → by-agent → today's failures → session details → schema check (after column error) → failure details → week-prior comparison → … Each query adds exactly one constraint to the previous. The coach never read any `session.jsonl` transcript to confirm the failure mode — stayed in aggregate SQL land for 30 ops.

## 3. The Divergent Technique

**"Anchor-then-diff" vs "Explore-then-synthesize"**

| Dimension | Low-op (anchor-then-diff) | High-op (explore-then-synthesize) |
|---|---|---|
| First bash | `cat <prior finding/todo>` | `ls <guessed path>` / `find .` / schema probe |
| Calls 2-3 | Read one artifact to anchor hypothesis | More discovery probes |
| DB use | 1-2 broad queries, scope-bounded by finding | 5-12 escalating queries, each adding one filter |
| Recovery waste | Low (0-1 avoidable calls) | High (3-6 avoidable: path guesses, schema guesses, quoting) |
| Transcript pulls | When needed, 1-2 direct | Either 0 (coach-664: stayed in SQL) or flailed via `jq`/regex |

The divergence is **most visible in the first 3 bash calls**: low-op sessions invest in *reading prior state*; high-op sessions invest in *discovering current state from scratch*.

## 4. Recurring Sub-Pattern: `.state/sessions/history/` path gotcha

In 617 **and** in this very session (s_1776475866053_759, bash #5 pivot warning), the initial `ls .state/sessions/<sid>/` failed because finished sessions are archived under `.state/sessions/history/<sid>/`. This costs 1-3 bash calls per optimizer archaeology. Frequency in 6h window: 2/3 archaeology-style sessions (≥67%).

## 5. R1 — NO_DISPATCH

Three candidate fixes were considered; none clear the adoption / stacking bar:

**Candidate A: Add "read prior finding first" heuristic to optimizer heartbeat.md or work-session prompt.**
- Blocker: KE-002 (text rules have 0% success for judgment failures) + KE-026 (Level-4 context.md ceiling ≈ 0% adoption). The "read first" behavior IS a judgment call about when anchoring is cheap enough; a prose rule won't fix it. Low-op 714 and 602 already do it without a rule.
- Stacking: Mode C 23:30 UTC already dispatched a P2 prompt tweak to tech-lead (inline diagnostic verification). Adding an optimizer-self prompt tweak same-day is not stacking across targets, but stacks two behavioral interventions from the same mode inside 2 hours — KE-123 risk.

**Candidate B: Patch session-query tool to auto-check `history/` fallback for session paths.**
- Appealing but mis-scoped: the waste is in raw `ls .state/sessions/<sid>/` bash calls, not in session-query. session-query already abstracts this correctly. The fix would be to *use* session-query instead of raw ls — which is itself a Level-4 context.md adoption problem (session-query has had 0 active adopters outside optimizer for 7+ days per todo.md).
- Structural version: add a one-liner to `agents/shared/skills/` or repo root README: "Live sessions live at `.state/sessions/<sid>/`; finished sessions at `.state/sessions/history/<sid>/`." Still Level-4.

**Candidate C: Dispatch a P2 to coach re: drill-down chain waste (664 ran 12 escalating queries).**
- Blocker: KE-125 (forced deliverable enumeration fails discovery). The coach task *was* open-ended investigation — drilling one filter at a time is a rational exploration strategy when the failure mode is unknown. Not a clean regression signal, and no structural enforcement fix (can't workflow-enforce "write a broader query").
- Also: Mode A 00:30 UTC already dispatched a P1 to may for the convention-check.ts false-positive root cause behind coach-664's investigation — the real fix is upstream. Adding a coach behavioral nudge now stacks.

**Verdict:** The signal is real and consistent (5/6 sessions fit the pattern) but the available interventions all land at Level 4 adoption ceiling or violate KE-123 stacking against the 23:30 and 00:30 dispatches still in flight. **NO_DISPATCH.**

## 6. What would be dispatchable

If the `.state/sessions/history/` path gotcha recurs in **≥3 sessions in the next 6h**, that becomes structural (Level 2 — tool wrapper): modify `scripts/session-query.ts` or add a new `scripts/session-path.sh <sid>` that resolves live-vs-history automatically. Filesystem-backed tool with a single entry point is Level 2-3 (adoptable). Log this as a watch item in todo.md and revisit after next Mode A rotation.

## 7. Data provenance

- Sessions query: `sessions` table, `startedAt >= now - 6h`, `opCount IS NOT NULL`, top 3 DESC + bottom 3 non-heartbeat ASC per top agent.
- Transcripts: `.state/sessions/history/<sid>/session.jsonl`, bash commands extracted via `/"name":"bash"[\s\S]*?"command":"((?:[^"\\]|\\.){0,2000})"/g`.
- Counts verified: 587=35 bash, 664=34, 617=31, 714=6, 602=11, 610=21 (matches `grep -c toolCall` minus non-bash tools).
