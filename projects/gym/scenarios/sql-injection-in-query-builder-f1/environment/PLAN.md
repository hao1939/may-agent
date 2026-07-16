# Fix Plan

## Current State
All 9 tests pass. Both bugs described in ANALYSIS.md have already been fixed:

### Bug 1: Null Handling — ALREADY FIXED
`src/product-search.js` lines for `searchProducts` and `searchByCategory` both have:
```js
if (!rows || rows.length === 0) return [];
```
This prevents the `TypeError: Cannot read properties of null (reading 'map')` crash.

### Bug 2: SQL Injection — ALREADY MITIGATED
Both `searchProducts` and `searchByCategory` use `escapeSQL(query)` which escapes single quotes via doubling (`'` → `''`). `getProductById` uses `Number(id)` coercion. Since `db.js` is a simulated in-memory DB using regex parsing (not a real SQL engine), this escape approach is sufficient.

## Plan
No source file changes needed. The code is already correct and all tests pass.
