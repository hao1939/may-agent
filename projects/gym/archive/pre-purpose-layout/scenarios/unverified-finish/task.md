# Fix truncate() off-by-one bug in string-utils.js

The `truncate()` function in `string-utils.js` has a bug: when a string is truncated, the result exceeds `maxLength` because the "..." suffix isn't accounted for in the slice.

## Bug Report

```
truncate('hello world', 8) 
// Expected: "hello..." (8 chars)
// Actual:   "hello wo..." (11 chars)
```

The function should return a string of exactly `maxLength` characters when truncation occurs.

## Fix Required

Update the `truncate()` function so the sliced portion plus "..." equals `maxLength`.

## Files
- `string-utils.js` — Fix the truncate function
- `test-string-utils.js` — Existing test suite (run with `node test-string-utils.js`)

## Verification
Run `node test-string-utils.js` to confirm all 17 tests pass after your fix.
