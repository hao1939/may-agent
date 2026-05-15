# Mode C: Technique Scouting — 2026-04-17 08:30 (6h window)

## (a) Method

1. Queried `evaluations JOIN sessions` for non-heartbeat sessions in last 6h, ordered by `quality DESC, efficiency DESC, opCount ASC`.
2. Identified **matched-pair natural experiment**: two `tech-lead` "Lens B: Flow Complexity" sessions, both **exactly 7 ops**, same agent, same task type, within the 6h window — but quality = **0.93** vs **0.35**. Controlling for ops and task kind makes technique-level differences visible.
3. Read both deliverable files (where present) and eval `issues` to locate the behavioral delta.

Queries used (inline via `bun -e` against `.state/may.db`):
```sql
-- Leaderboard
SELECT s.agent, s.opCount, s.sessionId, e.quality, e.verdict, substr(s.task,1,120)
FROM sessions s JOIN evaluations e ON s.sessionId=e.sessionId
WHERE s.startedAt > ? AND s.status='done' AND s.task NOT LIKE '[heartbeat]%'
ORDER BY e.quality DESC, e.efficiency DESC, s.opCount ASC;

-- Matched pair
SELECT sessionId, opCount, quality, verdict, issues
FROM sessions JOIN evaluations USING (sessionId)
WHERE agent='tech-lead' AND opCount IN (7,8) AND task LIKE 'Lens%';
```

## (b) Technique Identified

**Inline file:line citations in the deliverable** — the high-quality finding threads concrete references (`compose-guards.ts:48`, `finish-guard.ts:185`, `lifecycle.ts:189–258`) through a call-graph / layer-table structure. This format **forces** the author to actually `read()` each referenced file before writing the claim; there is nowhere to hide a fabricated assertion.

The low-quality sibling session produced a narrative finding with bare file *names* (no line numbers) and was flagged `[EVIDENCE_GAP]` because the transcript showed only "2 bash calls (one errored) and one write()" — classic FM-3.3 fabrication. Same task shape, same op budget, same workflow (`lens-analysis`); only the **output format discipline** differed.

Adjacent high-q examples using the same pattern (file:line + structural table) within the 6h window:
- `s_1776411091570_9` tech-lead Lens B finish-guard — 7 ops, q=0.93
- `tech-lead` Lens C dead-weight cron handlers — q=1.0
- `tech-lead` Lens D fragility callAgent — 19 ops, q=0.86

Low-q contrast:
- `s_1776396669376_301` tech-lead Lens B evaluator spawning — 7 ops, q=0.35, `needs_improvement`, EVIDENCE_GAP.

## (c) Evidence

### High-quality: `agents/tech-lead/workspace/finding-flow-complexity-trace-the-finish-gu.md`
Structural elements that encode the technique:
- **§1 Call Graph** names 6 source sites with file paths (`compose-guards.ts:48`, `finish-guard.ts:185`, `lifecycle.ts:189`) — each one corresponds to a read().
- **§2 Layer Count table** — columns `Location` carry line-anchored refs (`lifecycle.ts:189–258`, `compose-guards.ts:48`).
- **§5 Follow-Up** is scoped to "~5 lines of string" with explicit owner — deliverable-shape rigor.
- 74 lines total, 7 ops → high density.

### Low-quality: `s_1776396669376_301` Lens B evaluator
Eval issues (verbatim excerpt):
> "[EVIDENCE_GAP] Claimed multiple concrete findings (30% sampling, MAX_LLM_PER_RUN=5, evaluator.ts line numbers, DB query confirming 60 sessions, agent.json model/tools) but transcript shows no supporting reads/queries; only 2 bash calls (one errored) and one write(). This is FM-3.3-style unverified…"

The agent *mentioned* line numbers in prose but never opened the files. The failure mode is: **claim evidence-shaped text without producing evidence-shaped tool calls.**

## (d) Proposed Insertion Point + Dispatch

**Insertion point (exact file + change):**
File: `agents/shared/workflows/lens-analysis.md` (or wherever the lens-analysis workflow task template lives — tech-lead heartbeat references `workflow.run("lens-analysis", …)`).

Add one WRITE phase requirement:
> **Finding format**: every claim about code must include a `path:line` citation (e.g., `src/lib/tools/finish-guard.ts:185`). If you cannot cite a line, you have not read enough — `read()` the file first. Table-of-locations or call-graph sections are preferred over prose.

Alternative lighter-touch insertion: add to `agents/tech-lead/skills/` a new file `skills/cite-by-line.md` (2-3 sentences), referenced from the `lens-analysis` workflow prompt.

**Why this works (ties to KE-060 intervention taxonomy):**
- This is a **structural gate** inside an already-enforced workflow prompt (the only reliable intervention class per KE-007). Not a text-rule suggestion appended to a heartbeat.
- It attacks FM-3.3 (top failure class in optimizer's active-recall) at the format level, not the post-hoc verification level.
- Cost: ≤10 lines of prompt text, zero code.

**Dispatch status: DISPATCHED via `agents.message` to tech-lead** (see session end).
Rationale for dispatching: concrete target file, concrete change, clear evidence. Fits optimizer's "don't just log — dispatch" rule.

## Caveats

- n=2 matched pair (7-op Lens B sessions). Directionally strong because evaluator-assigned quality is independent of format, but worth validating across 3-5 more pairs if easy.
- The high-q session was also run via `workflow.run("lens-analysis", …)` per the heartbeat template, so the structural wrapper already exists — we are tightening its WRITE phase, not adding a new gate.
- Do NOT stack this with other interventions in the same cycle (KE-123).
