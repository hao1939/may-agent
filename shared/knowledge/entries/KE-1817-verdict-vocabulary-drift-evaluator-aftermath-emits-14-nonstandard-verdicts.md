<ai_context>
The evaluator's aftermath pipeline emits 14+ non-standard reviewedVerdict values (e.g. "partial_value", "needs_repair", "mixed_value") because artifactVerdict() returns raw free-form strings for any verdict that doesn't start with good/acceptable/needs_improvement/low_quality. These verdicts never trigger shouldOverrideWithReview() and silently fall through — the override pathway only handles downgrade cases. 37 of 472 evaluation.reviewed events in 24h carry non-standard verdicts that the system records but never acts on.
Triggers: verdict drift, evaluator aftermath, artifactVerdict, reviewedVerdict, shouldOverrideWithReview, evaluation.reviewed, non-standard verdict, free-form verdict
</ai_context>

# KE-1817: Verdict Vocabulary Drift — Evaluator Aftermath Emits 14+ Non-Standard Verdicts

**Created**: 2026-06-11
**Author**: arc (heartbeat coherence audit)
**Status**: verified
**Confidence**: 0.95 — counts are from production DB, code path confirmed in source
**Domains**: evaluator, evaluation-pipeline, data-quality
**Connects**: KE-1805 (Tautology Engine), KE-1810 (Contrastive Zone)

---

## Observation

The evaluator's aftermath pipeline (`evaluator-aftermath.ts`) emits `evaluation.reviewed` events with a `reviewedVerdict` field. The system's evaluation metrics and downstream logic assume a closed vocabulary: `good`, `acceptable`, `needs_improvement`, `low_quality`. In practice, 14 non-standard verdict strings are being emitted and recorded, silently falling outside all downstream logic.

## Evidence

### Code Path (evaluator-aftermath.ts, line 1364)

```typescript
export function artifactVerdict(artifactText: string): string | null {
  const match = artifactText.match(/^\s*#{1,3}\s*Verdict\s*\n+\s*([a-z_ -]+)/im);
  const raw = match?.[1]?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return null;
  if (raw.startsWith("needs_triage")) return "needs_improvement";
  if (raw.startsWith("needs_improvement")) return "needs_improvement";
  if (raw.startsWith("low_quality")) return "needs_improvement";
  if (raw.startsWith("good")) return "good";
  if (raw.startsWith("acceptable")) return "acceptable";
  return raw;  // ← fallthrough: any unrecognized verdict emitted verbatim
}
```

The `return raw` on the final line means any verdict written in an aftermath artifact that doesn't start with one of the four known prefixes passes through unchanged.

### shouldOverrideWithReview() (line 1376)

```typescript
function shouldOverrideWithReview(storedVerdict: string, reviewedVerdict: string | null): boolean {
  if (!reviewedVerdict) return false;
  if (storedVerdict === "good") return ["needs_improvement", "acceptable"].includes(reviewedVerdict);
  if (storedVerdict === "acceptable") return reviewedVerdict === "needs_improvement";
  return false;
}
```

This only handles exact-match downgrades. Non-standard verdicts like `needs_repair` or `partial_value` never match, so `shouldOverrideWithReview()` returns false and the original heuristic verdict stands.

### Production Data (24h window, 2026-06-11)

472 `evaluation.reviewed` events total. Non-standard verdicts:

| Verdict | Count |
|---------|-------|
| `partial_value` | 17 |
| `real_value_delivered` | 5 |
| `mixed_value` | 3 |
| `partial_value_only` | 2 |
| `mixed` | 2 |
| `valuable_success_with_notable_waste` | 1 |
| `useful_session_with_real_value_delivered` | 1 |
| `useful_but_flawed` | 1 |
| `partial_real_value` | 1 |
| `partial_diagnosis` | 1 |
| `mixed_success` | 1 |
| `delivered_real_project_value` | 1 |
| `confirmed_success_candidate` | 1 |
| `accepted_with_repair_notes` | 1 |

**37 of 472 events (7.8%)** carry a non-standard verdict.

Additionally, all 472 events have NULL for `evaluationType`, `evaluatorType`, and `method` fields — these are never populated by the aftermath pathway.

## Implication

1. **Silent data loss**: When an aftermath reviewer writes "needs_repair" in the `# Verdict` line, the evaluator LLM is expressing a nuanced judgment. But the system only acts on 4 verdict values. The 14 free-form verdicts are recorded in the event stream but never trigger override logic, never appear in metrics, and never feed back to agents. The evaluator's work is wasted for these 37 sessions.

2. **Measurement contamination**: Metrics like `evaluator.low-quality-rate-24h` and `evaluator.false-good-rate-sample` are computed from the standard verdict vocabulary. Sessions with non-standard verdicts like `needs_repair` or `partial_value` are not counted as quality failures, understating the true failure rate. Rough estimate: the real low-quality rate is ~4-8% higher than reported.

3. **Semantic intent is clear**: Most non-standard verdicts map naturally:
   - `needs_repair`, `partial_value`, `partial_value_only`, `partial_diagnosis`, `partial_real_value`, `useful_but_flawed`, `mixed`, `mixed_value`, `mixed_success` → `needs_improvement`
   - `real_value_delivered`, `delivered_real_project_value`, `useful_session_with_real_value_delivered`, `confirmed_success_candidate` → `acceptable` or `good`
   - `valuable_success_with_notable_waste`, `accepted_with_repair_notes` → `acceptable`

## Recommendation

**Short-term (no src/ change)**: Document the issue and alert the evaluator agent that its aftermath artifacts should use only the 4-value canonical vocabulary (`good`, `acceptable`, `needs_improvement`, `low_quality`). Add this constraint to evaluator guidance.

**Medium-term (src/ change, ORDER-010)**: Extend `artifactVerdict()` with additional prefix mappings:
```typescript
if (raw.startsWith("needs_repair")) return "needs_improvement";
if (raw.startsWith("partial")) return "needs_improvement";
if (raw.startsWith("mixed")) return "needs_improvement";
if (raw.startsWith("delivered") || raw.startsWith("real_value")) return "acceptable";
if (raw.startsWith("useful")) return "acceptable";
if (raw.startsWith("confirmed")) return "good";
if (raw.startsWith("valuable")) return "acceptable";
```

Or, more robustly, log a warning when `raw` doesn't match a known prefix, and default to `needs_improvement` for unknown verdicts (fail-safe: unrecognized = suspect).
