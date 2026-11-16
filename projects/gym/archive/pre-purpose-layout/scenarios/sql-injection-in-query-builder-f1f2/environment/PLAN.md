# Fix Plan

## Current State

All 9 tests pass. Both bugs described in ANALYSIS.md have already been fixed in the current code.

## Bug 1: Null dereference on empty results — ALREADY FIXED

- **File**: `src/product-search.js`
- **Root cause**: `db.js` `executeQuery()` returns `null` when no rows match (line 82: `if (results.length === 0) return null;`)
- **Current fix**: Both `searchProducts()` and `searchByCategory()` have `if (!rows || rows.length === 0) return [];` guards before calling `.map()`.
- **Action needed**: None. The guards are correct and tests pass.

## Bug 2: SQL injection via string interpolation — ALREADY FIXED

- **File**: `src/product-search.js`
- **Root cause**: Originally user input was interpolated directly into SQL strings.
- **Current fix**: Parameterized queries with `?` placeholders. User input passed via `params` array to `executeQuery()`. `db.js` handles `?` binding for LIKE, category, and id clauses.
- **Action needed**: None. Parameterized queries are in place.

## Remaining improvement (not required)

`db.js` line 82 still returns `null` instead of `[]` for empty results. This is an unusual contract — ideally `executeQuery()` would return `[]` for no matches. However, since callers already guard against `null`, this is cosmetic and not a bug.

## Verification

```
$ node test/product-search.test.js
9 passed, 0 failed
```

No code changes required.
