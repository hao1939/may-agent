# Fix Plan

## ANALYSIS.md Accuracy Check

**Verified**: ANALYSIS.md claims both critical bugs are "Already Fixed". **This is wrong.** Both bugs still exist in the code:

### Bug 1: Null Return from `executeQuery` (db.js:49)
- **ANALYSIS claims**: "db.js now always returns an array (empty [] for no matches)"
- **Reality**: Line 49 of db.js reads `if (results.length === 0) return null;`
- **Why tests pass**: product-search.js has null guards (`if (!rows || rows.length === 0) return [];`) that mask this bug
- **Fix**: Change `return null` to `return []` on db.js line 49

### Bug 2: SQL Injection via String Interpolation (product-search.js)
- **ANALYSIS claims**: "Both product-search.js and db.js now use parameterized queries with ? placeholders"
- **Reality**: All three functions use template literal interpolation:
  - Line 19: `` `SELECT * FROM products WHERE name LIKE '%${query}%'` ``
  - Line 37: `` `SELECT * FROM products WHERE category = '${category}'` ``
  - Line 54: `` `SELECT * FROM products WHERE id = ${id}` ``
- `executeQuery` takes only ONE argument (sql) — no params parameter exists
- **Fix**: Add `params` parameter to `executeQuery` in db.js, use it for filtering instead of regex-parsing the SQL string. Update product-search.js to pass params separately.

## Exact Changes

### File: `src/db.js`
1. Change `executeQuery(sql)` signature to `executeQuery(sql, params)`
2. Use `params` array values instead of regex-extracting values from SQL string
3. Line 49: Change `return null` to `return []`

### File: `src/product-search.js`
1. `searchProducts`: Change to `executeQuery('SELECT * FROM products WHERE name LIKE ?', ['%' + query + '%'])`
2. `searchByCategory`: Change to `executeQuery('SELECT * FROM products WHERE category = ?', [category])`
3. `getProductById`: Change to `executeQuery('SELECT * FROM products WHERE id = ?', [Number(id)])`
4. Null guards (`if (!rows || rows.length === 0)`) can stay as defensive coding but are no longer needed after db.js fix

## Verification
- Run all 9 tests: `node test/product-search.test.js` — expect 9 passed, 0 failed
