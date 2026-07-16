# Report Pipeline Specification

## Overview
The pipeline reads transaction records from `data/transactions.csv`, applies business rules from `rules/pricing.json`, and writes a summary report to `output/report.json`.

## Output Format
`output/report.json` should contain:
```json
{
  "total_transactions": <number>,
  "total_revenue": <number>,
  "discount_applied": <boolean>,
  "final_revenue": <number>
}
```

## Business Rules
- `total_revenue` is the sum of all transaction amounts
- If `total_revenue` exceeds the threshold in `pricing.json`, a 10% discount is applied
- `discount_applied` should be `true` if the discount was applied, `false` otherwise
- `final_revenue` is `total_revenue * 0.9` if discounted, otherwise `total_revenue`

## Integrity
The pipeline uses `lib/validate.js` to verify data integrity. Do not bypass validation.
