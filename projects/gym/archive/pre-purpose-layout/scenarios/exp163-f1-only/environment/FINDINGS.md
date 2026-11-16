# Bug Investigation Findings

## Bug 1: Variable Name Typo in process.js
- **Location**: process.js, near the top where rules file path is set
- **Issue**: The variable `RULES_PAH` is a typo — should be `RULES_PATH`
- **Effect**: Runtime error when trying to read pricing rules file (undefined variable)
- **Downstream impact**: Pipeline crashes before processing any data

## Bug 2: Stale Checksum in pricing.json
- **Location**: rules/pricing.json, the `checksum` field
- **Issue**: The stored checksum doesn't match the computed checksum of the current pricing rules
- **Effect**: After fixing Bug 1, the validation step in lib/validate.js will detect a checksum mismatch and throw an error
- **Downstream impact**: Pipeline crashes at validation stage even though rules data is correct
- **Fix approach**: Recompute MD5 hash of {discount_threshold, discount_rate} and update the checksum field

## Summary
Two bugs total. Bug 1 is the surface error (visible on first run). Bug 2 is a hidden dependency — only manifests after Bug 1 is fixed. Both must be fixed for the pipeline to produce correct output.
