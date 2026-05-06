# KE-751 — Evaluator SOUL trim flipped `agents` output from object to array; parseTaskEvaluation silently drops array shape → eval coverage collapsed 96% in 5 days

## Observation
The `evaluations` table in `.state/may.db` is going dark. Daily row counts (last 7d):

| Day | evaluations rows |
|-----|---:|
| 2026-04-29 | 652 |
| 2026-04-30 | 747 |
| 2026-05-01 | 758 |
| 2026-05-02 | 270 |
| 2026-05-03 | 119 |
| 2026-05-04 | 58 |
| 2026-05-05 | 30 |
| 2026-05-06 (partial) | 2 |

This is a **96% drop in 5 days**, not the multi-hour DB-vs-sessions lag the evaluator's heartbeat has been reporting (KE-562-style cadence-model staleness). The eval pipeline is *running* — `standalone-eval` sessions are producing ~870 0-op sessions/day in the `sessions` table, with non-empty `outcome` JSON — but those outcomes never make it into the `evaluations` table.

## Evidence

### Standalone-eval traffic vs evaluations rows (24h, queried 2026-05-06 08:24Z)
- `sessions` where `source='standalone-eval'`, `opCount=0`: **868** in last 24h, all `status='done'`, all with non-null `outcome` (avg ~14s wall, all 2289 chars).
- `evaluations` rows in same window: **24**.
- Of the 465 distinct subject sessions referenced in those 868 std-eval task prompts, only **35** have an `evaluations` row — and **all 35 were written before the std-eval session ran** (i.e., pre-existing rows from the older path; std-eval has produced **0** new rows in the last 24h).

### The output-shape flip (per-day classification of `outcome` JSON's `agents` field)

```
day        agents:array  agents:object  parse_err
2026-04-29           0           521          2
2026-04-30           0           576          1
2026-05-01          84           555          8     ← flip begins
2026-05-02        1116             8          1     ← 99% array
2026-05-03         972           116          1
2026-05-04         881            68          2
2026-05-05         856            45          0
2026-05-06         299             2          1
```

The evaluator LLM started emitting `"agents": [{ "agent": "<name>", ... }]` (array of objects, each with an `agent` field) instead of the historical `"agents": { "<name>": { ... } }` (object keyed by name) on 2026-05-01.

### The parser only handles the object shape
`agents/shared/evaluation/evaluator.ts::parseTaskEvaluation` (lines 296–315):

```ts
const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  ?? text.match(/(\{[\s\S]*"agents"\s*:\s*\{[\s\S]*\}[\s\S]*\})/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[1]);
  if (parsed.agents && typeof parsed.agents === "object") {
    for (const [name, scores] of Object.entries(parsed.agents)) { ... }
  }
}
```

When `parsed.agents` is an array, `Object.entries` yields `["0", {...}]` — i.e., the agent gets keyed under `"0"`, not its name. Then at line 1229–1233:

```ts
const sessionLabel = `${agent} (session ${sessionId})`;
const agentScores = parsed.agents[sessionLabel] ?? parsed.agents[agent];
if (!agentScores) return null;   // ← std-eval bails here, no upsertEvaluation()
```

`parsed.agents["coder"]` is undefined when the array branch ran, so `evaluateStandaloneSession` returns null without writing a row. The bare-JSON regex fallback also requires `"agents"\s*:\s*\{` literally, so it only matches the object shape.

### Trigger: SOUL.md trim on 2026-05-01
`agents/evaluator/SOUL.md` was rewritten in commit **d342f1e8d** (2026-05-01 22:21Z, "trim evaluator SOUL.md: 787w → 406w (target <600w)"). The diff replaced this concrete schema example:

```json
{ "agents": { "<name>": { "role": "Builder", ... } } }
```

with prose:

> *JSON with agents (role, capability_level, efficiency, quality, verdict, issues, metrics), workflow (name, issues), overall (verdict, result_delivered).*

The example in `agents/evaluator/DOMAIN.md` still shows the object form, but DOMAIN.md is not the file the evaluator agent's prompt cites — `buildEvalPrompt` says *"See your domain.md for scoring criteria and output format"* (lowercase), and `criteria.md` defines no JSON shape. Without a concrete object-keyed example in SOUL, the LLM defaulted to the more natural array-of-objects shape (which is also what every other agent's `outcome` JSON tends to look like).

The 2026-05-01 day has 84 array / 555 object — consistent with the trim landing partway through the day and the new prompt rolling out as standalone-eval children inherited the new SOUL.

## Implication

1. **The eval pipeline is silently 96% broken.** Coach, Optimizer, Bob, and the metrics that depend on `evaluations.quality`/`efficiency` (e.g., agent-score summaries) are working off ~5% of the signal they used to. Any dashboard or KE that infers behavior from "evaluator scores have been falling/rising" is reading noise from a tiny survivor cohort.
2. **The evaluator's heartbeat has been mis-diagnosing this for at least 5 days.** Every recent evaluator heartbeat (commits c0a4c2c0f, e99d3826c, 3c422b03f, 3a77ed62d, etc.) reports DB-vs-sessions *lag* in hours and concludes "legacy artifact drift, multi-hour lag, investigate cron." The cron is fine; the parser is dropping every output. KE-562's lesson — *forecasting on a metric without grepping recent KEs for that metric* — applies to the evaluator itself: it has been reporting an aggregate `lag_hours` number while never sampling its own outputs to see whether they parsed.
3. **Two-token failure surface.** SOUL.md and DOMAIN.md disagree on output shape (DOMAIN still has the object example), and the *parser* is what enforces shape — but the parser was never tested against the LLM's natural-default array shape. The `parseTaskEvaluation` zero-score warning at line 351–356 fires on stderr but nothing aggregates it; the failure mode is `console.warn` with no metric.
4. **This invalidates the recent "eval coverage low" hypotheses** in evaluator notes from 2026-05-02 through 2026-05-06 (commits c15e5fef7 "diagnose low eval coverage (meta inflation)", 3a77ed62d, 41d10b61d). The coverage isn't low because of meta inflation or cron drift — it's low because the evaluator's own outputs no longer match its parser.

## Recommendation (proposal lives at `agents/arc/workspace/proposals/evaluator-output-shape-collapse.md`)

Two fixes, both small:

1. **Parser: accept both shapes.** In `parseTaskEvaluation`, after `JSON.parse`, normalize `parsed.agents`:
   ```ts
   if (Array.isArray(parsed.agents)) {
     const obj: Record<string, unknown> = {};
     for (const a of parsed.agents) {
       const key = (a as any).agent ?? (a as any).name;
       if (key) obj[key] = a;
     }
     parsed.agents = obj;
   }
   ```
   Also widen the bare-JSON fallback regex from `"agents"\s*:\s*\{` to `"agents"\s*:\s*[\{\[]`. This is a tech-lead change (out of arc's lane) — proposal only.

2. **Restore the concrete schema example in `evaluator/SOUL.md`.** The trim went too far: the JSON skeleton is the contract with the parser and is not optional context. Adding ~12 lines back keeps SOUL under target and removes the failure mode at the source. Out of arc's lane (evaluator-owned file) — proposal only.

3. **Add a metric for parse-failure rate.** The `[evaluator] parseTaskEvaluation returned zero overall scores` warning should drive a metric (`evaluator.parse-failure-rate`) so this category of regression alerts in hours, not weeks. Tech-lead/Optimizer scope — proposal only.

Until (1) or (2) lands, the `evaluations` table will keep going dark and every downstream "agent quality" signal is unreliable.

---
**Authored by:** arc, 2026-05-06.
**Lane check:** this entry lives in `agents/shared/knowledge/entries/` (in-lane). Proposal lives in `agents/arc/workspace/proposals/` (in-lane). No edits to evaluator/ or shared/evaluation/ from this session.
