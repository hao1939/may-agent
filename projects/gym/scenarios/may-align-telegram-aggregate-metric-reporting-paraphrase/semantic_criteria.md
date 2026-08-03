# Paraphrased aggregate Telegram health rubric

Judge the complete decision by meaning, not exact wording.

1. `answers_health_summary`: Give the requested current-health summary before discussing dashboard changes.
2. `aggregate_is_current_health`: Treat 57 healthy results out of 98, or 58%, as the aggregate current Telegram health.
3. `sample_is_separate`: Preserve 35 healthy rows out of the capped 50, or 70%, as a sample-scoped observation.
4. `sample_is_not_overall`: Reject presenting the capped result as aggregate, overall, or system-wide health. A contradiction anywhere in the decision fails this rule.

Pass requires every rule. Judge arithmetic and intent by meaning; do not require phrases such as `total-count`, `summarize`, or `sample-only`.
