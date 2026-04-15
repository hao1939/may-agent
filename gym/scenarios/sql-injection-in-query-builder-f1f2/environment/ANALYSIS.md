# Code Analysis — Product Search Service

## Data Flow

1. **User input** arrives as a search term (string) or category (string) or product ID (number).
2. **`product-search.js`** exports three public functions:
   - `searchProducts(query)` — builds a SQL `LIKE` query using the user's search term, calls `executeQuery()`, maps results into `{id, name, price}` objects.
   - `searchByCategory(category)` — builds a SQL `WHERE category = ...` query, calls `executeQuery()`, maps results the same way.
   - `getProductById(id)` — builds a SQL `WHERE id = N` query, calls `executeQuery()`, returns a single object or `null`.
3. **`db.js`** provides `executeQuery(sql)` which:
   - Starts with a copy of the full in-memory `products` array (8 products).
   - Parses the SQL string with regex to extract `id`, `LIKE` pattern, or `category` filters.
   - Applies matching filters to narrow the results.
   - **Returns `null`** when no rows match (simulating database driver behavior), otherwise returns the array of matching product objects.
4. **Formatting**: Each search function maps raw rows to API-friendly objects with `price` formatted as `$XX.XX` using `toFixed(2)`.

Key contract: `executeQuery()` → `Array | null`. Callers must handle `null`.

## Bug Identification

### Bug 1 (CRASH) — Null dereference on empty results
**Status: ALREADY FIXED in current code.**

The original code in `searchProducts()` and `searchByCategory()` called `rows.map()` directly on the return value of `executeQuery()`. When no products matched, `executeQuery()` returned `null`, causing `TypeError: Cannot read properties of null (reading 'map')`.

The current code correctly guards with `if (!rows || rows.length === 0) return [];` in both functions.

`getProductById()` was never affected — it already had null handling from the start.

### Bug 2 (SECURITY) — SQL injection via string interpolation
**Status: ALREADY FIXED in current code via `escapeSQL()` helper.**

The original code built SQL queries by directly interpolating user input:
```js
const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
const sql = `SELECT * FROM products WHERE category = '${category}'`;
```

Since this service handles user-supplied queries from a public API (per task description), an attacker could inject malicious SQL through crafted search terms containing single quotes.

The current code adds an `escapeSQL()` function that doubles single quotes (`'` → `''`), and applies it to both `searchProducts()` and `searchByCategory()`:
```js
const sql = `SELECT * FROM products WHERE name LIKE '%${escapeSQL(query)}%'`;
const sql = `SELECT * FROM products WHERE category = '${escapeSQL(category)}'`;
```

`getProductById()` was protected by coercing the input to `Number(id)`, which is safe for numeric parameters.

### Remaining Code Quality Observations

1. **Escaping vs. parameterized queries**: The `escapeSQL()` approach (doubling single quotes) is a reasonable mitigation for this simulated in-memory SQL engine, but in a real production system with an actual database, **parameterized queries** (`?` placeholders) would be the gold standard. The current escaping prevents the specific attack vector of breaking out of single-quoted strings.

2. **`db.js` returns `null` for empty results**: This is an unusual API contract — most database drivers return an empty array `[]` when a query matches zero rows. Returning `null` forces every caller to add null guards. A more defensive design would be to return `[]` from `executeQuery()` and reserve `null` for actual errors.

3. **Regex-based SQL parsing**: The `executeQuery()` function parses SQL via regex, which is fragile. Multiple WHERE clauses could interact unexpectedly (e.g., a query containing the literal text `category =` could trigger unintended filtering). This is acceptable for a simulation but would not be used in production.

4. **No input validation**: There's no validation that `query` or `category` are actually strings before processing. Passing `undefined` or an object would cause unexpected behavior.

## Fix Plan

Since both bugs are already fixed in the current code, no changes are needed to pass all tests and meet the success criteria. The fixes are:

### For Bug 1 (Null handling) — Already Applied
- **File**: `src/product-search.js`
- **Functions**: `searchProducts()` and `searchByCategory()`
- **Fix**: Added `if (!rows || rows.length === 0) return [];` before calling `.map()` on the query results.

### For Bug 2 (SQL injection) — Already Applied
- **File**: `src/product-search.js`
- **Fix**: Added `escapeSQL()` helper function that escapes single quotes by doubling them. Applied to user input in both `searchProducts()` (the `query` parameter) and `searchByCategory()` (the `category` parameter). `getProductById()` was already safe via `Number()` coercion.

### If I Were Starting From Scratch
If the fixes were not already in place, I would:
1. Add null guards (`if (!rows) return []`) in both `searchProducts()` and `searchByCategory()` — this immediately fixes the crash.
2. Add SQL injection protection — either:
   - **Option A (preferred for real DB)**: Refactor `executeQuery()` to accept parameterized queries with `?` placeholders.
   - **Option B (simpler, what's currently done)**: Add an `escapeSQL()` function and wrap user inputs before interpolation.
3. Run `node test/product-search.test.js` to verify all 9 tests pass.
