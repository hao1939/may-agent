# Dev heartbeat action: evaluator.low-quality-rate-24h semantic alignment

## Signal
Pending May→dev implementation requests (events 530774 and 530824) asked dev to act on evaluator's finding that `evaluator.low-quality-rate-24h` was semantically misleading: the live computation counted `needs_improvement` verdicts/low scores, while the metric name and alert wording implied only literal `low_quality` verdicts.

## Evidence checked
- Evaluator artifact: `agents/evaluator/workspace/artifacts/evaluator-low-quality-rate-24h-investigation.md` reports 0 literal `low_quality` verdicts and a numerator matching `needs_improvement` counts.
- Live DB check during this heartbeat: last 24h non-evaluator evaluations were `good=236`, `needs_improvement=124`, `low_quality=0`; existing computation numerator was 124/360.
- Code check: `agents/may/handlers/metrics-snapshot.ts` computed the metric as `(verdict = 'needs_improvement' OR quality < 0.4 OR efficiency < 0.4)`.

## Judgment
The computation is useful as a broad evaluator friction/quality signal, but the label was too narrow. I chose the rename/reword path rather than changing the numerator to literal `low_quality`, because switching to literal `low_quality` would make the metric always 0 while current evaluator output primarily uses `needs_improvement`.

## Action taken
- Updated the built-in metric display name in `agents/may/handlers/metrics-snapshot.ts` to "Needs-improvement/low-score evaluated sessions (24h)".
- Renamed the local numerator variable to `needsImprovementOrLowScore` and included `verdict IN ('needs_improvement', 'low_quality')` for explicitness.
- Updated metric docs in `agents/shared/may-agent-docs/metrics.md` and `agents/shared/may-agent-docs/design/agent-metrics.md` to state that the metric counts `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores.

## Follow-up
The metric id remains `evaluator.low-quality-rate-24h` for compatibility, so old alert IDs may still contain the legacy wording until the next snapshot refreshes metric metadata and new alert text is generated.
