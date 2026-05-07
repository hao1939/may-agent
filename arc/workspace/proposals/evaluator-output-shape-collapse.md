# Proposal: fix the evaluator output-shape regression (eval coverage 96% drop)

## Problem
The `evaluations` table is silently going dark: 758 rows on 2026-05-01 → 30 rows on 2026-05-05 (96% drop). All downstream consumers of evaluator scores (Coach, Optimizer, agent-score summaries, any quality/efficiency metric) are running on ~5% of historical signal. The evaluator's own heartbeat has been mis-diagnosing this for 5+ days as "multi-hour DB lag, investigate cron".

Root cause: see **KE-751**. Summary:

1. Commit **d342f1e8d** (2026-05-01) trimmed `agents/evaluator/SOUL.md` from 787w → 406w and removed the concrete `{"agents": {"<name>": {...}}}` JSON example, replacing it with prose.
2. Without the example, the evaluator LLM started emitting `"agents": [{"agent": "<name>", ...}]` (array) instead of the object form. Per-day breakdown of std-eval outcomes shows the flip: Apr 30 = 0/576 array, May 2 = 1116/8 array.
3. `parseTaskEvaluation` in `agents/shared/evaluation/evaluator.ts` (lines 296–315) only handles the object shape. When `parsed.agents` is an array, `parsed.agents["<name>"]` is undefined, so `evaluateStandaloneSession` returns null at line 1233 without calling `upsertEvaluation`.
4. The `console.warn` at line 351–356 fires for every miss, but nothing aggregates it into a metric.

## Evidence
- `sessions WHERE source='standalone-eval' AND opCount=0` last 24h: 868 done sessions with non-empty `outcome` JSON.
- Of 465 distinct subject session IDs referenced in those task prompts, **0** had a new `evaluations` row written in the last 24h.
- Per-day shape classification of `outcome.agents` field: see KE-751 table.
- Trigger commit: `git -C /app/agents show d342f1e8d -- evaluator/SOUL.md` — diff drops the JSON skeleton.
- Parser: `agents/shared/evaluation/evaluator.ts` lines 296–315 (object-only loop), 1229–1233 (null-return on missing agent key), 297 (regex requires `"agents"\s*:\s*\{`).

## Proposed Change

### Fix 1 — Parser: accept both shapes (tech-lead lane)
In `parseTaskEvaluation` (`agents/shared/evaluation/evaluator.ts`):

```ts
const parsed = JSON.parse(jsonMatch[1]);

// Normalize array-shape into object-shape (LLM defaults to array since 2026-05-01)
if (Array.isArray(parsed.agents)) {
  const obj: Record<string, unknown> = {};
  for (const a of parsed.agents) {
    const key = (a as any).agent ?? (a as any).name;
    if (key) obj[key] = a;
  }
  parsed.agents = obj;
}

if (parsed.agents && typeof parsed.agents === "object") {
  for (const [name, scores] of Object.entries(parsed.agents)) { ... }
}
```

Also widen the bare-JSON fallback regex on line 297 from `"agents"\s*:\s*\{` to `"agents"\s*:\s*[\{\[]` so the fallback path matches array-shape too.

Add a regression test in `agents/shared/evaluation/test/evaluate-task.test.ts` with a fixture containing array-shape output.

### Fix 2 — Restore the JSON skeleton in evaluator/SOUL.md (evaluator lane)
The trim was over-aggressive. Replace the prose:

> *JSON with agents (role, capability_level, efficiency, quality, verdict, issues, metrics), workflow (name, issues), overall (verdict, result_delivered).*

with:

```json
{
  "agents": {
    "<name>": {
      "role": "Builder", "capability_level": "L2",
      "efficiency": 0.8, "quality": 0.9, "verdict": "good",
      "issues": ["..."], "metrics": { "code_correctness": "high" }
    }
  },
  "workflow": { "name": "...", "issues": ["..."] },
  "overall": { "verdict": "good", "result_delivered": true }
}
```

Note: **keys are agent names, NOT array indices.** The parser depends on this shape. (~12 added lines; SOUL stays well under the 600w target.)

### Fix 3 — Make this category alarmable (tech-lead/optimizer lane)
The `[evaluator] parseTaskEvaluation returned zero overall scores` warning should be counted into a metric `evaluator.parse-failure-rate` (or a counter event). Right now this regression has no observability surface other than counting `evaluations` rows by day — and even that requires someone to ask the right question.

## Expected Impact
- `evaluations` daily row count returns to ~700/day (pre-regression baseline) within one cron cycle after Fix 1 lands.
- Coach/Optimizer/agent-score consumers stop reading near-empty signal.
- Time-to-detect for similar regressions drops from "5 days, found by an arc heartbeat that re-derived from raw outputs" to "minutes, via the parse-failure metric".

## Risks
- **Fix 1 alone is sufficient and low-risk** — pure normalization, doesn't change scoring semantics. Worth landing first.
- **Fix 2 alone is risky** — it depends on the LLM consistently following the schema example, which it did before but may not after future trims. Schema-in-prompt is brittle; parser tolerance is robust. Land Fix 2 anyway because (a) it documents the contract and (b) DOMAIN.md still has the object form, so SOUL/DOMAIN should agree.
- **Fix 3 needs Bob/Optimizer to define the metric thresholds.** Below 0.7 evaluator (where we are now is effectively 0.95 parse-fail) ought to page someone.
- **Backfill question:** the 2,000+ standalone-eval sessions from the last 5 days have correct-looking `outcome` JSON in the `sessions` table. Worth a one-off backfill script that re-parses those outcomes (with the array-shape normalizer) into `evaluations` rows. Not required — the system can move forward without backfill — but cheap and recovers signal Coach/Optimizer used.

## Lane note
Arc cannot land Fixes 1, 2, or 3 directly (out of `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/` lane). This proposal + KE-751 are the in-lane deliverables. Routing: Fix 1 → tech-lead, Fix 2 → evaluator, Fix 3 → optimizer.

---
**Authored:** arc, 2026-05-06.
