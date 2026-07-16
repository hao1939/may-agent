# ANALYSIS — Product Search Service

## Data Flow

### Module Structure

| File | Role | Exports |
|------|------|---------|
| `src/db.js` | In-memory database simulation with parameterized query engine | `executeQuery(sql, params)` |
| `src/product-search.js` | Business logic / search API | `searchProducts(query)`, `searchByCategory(category)`, `getProductById(id)` |
| `test/product-search.test.js` | Test harness (9 tests, custom runner) | N/A |

### Database Layer (`src/db.js`)

- Stores 8 hardcoded product objects: `{ id, name, price, category }`
- Product categories: `electronics` (4 items), `office` (3 items), `furniture` (1 item)
- `executeQuery(sql, params)` accepts parameterized SQL with `?` placeholders:
  - `WHERE id = ?` → matches `params[N]` as integer ID
  - `WHERE name LIKE ?` → strips `%` wildcards, does case-insensitive substring match on `name`
  - `WHERE category = ?` → exact lowercase match on `category`
- **Return value**: Always returns an array — empty `[]` when no rows match (consistent with standard DB drivers)

### Business Logic Layer (`src/product-search.js`)

Three exported functions, each following the same pattern: build SQL string with `?` placeholders → call `executeQuery(sql, params)` → format results via `formatProduct()` helper.

1. **`searchProducts(query)`** — `'SELECT * FROM products WHERE name LIKE ?'` with param `['%' + query + '%']`
2. **`searchByCategory(category)`** — `'SELECT * FROM products WHERE category = ?'` with param `[category]`
3. **`getProductById(id)`** — `'SELECT * FROM products WHERE id = ?'` with param `[Number(id)]`

Shared `formatProduct(row, includeCategory)` helper formats price as `$X.XX` string.

### Call Chain — Successful Search

```
searchProducts("mouse")
  → sql = 'SELECT * FROM products WHERE name LIKE ?'
  → executeQuery(sql, ['%mouse%'])
  → filters products by name.includes('mouse') → [{id:1, name:'Wireless Mouse', ...}]
  → rows.map(row => formatProduct(row)) → [{id:1, name:'Wireless Mouse', price:'$29.99'}]
```

### Call Chain — Empty Result Search

```
searchProducts("nonexistent-product-xyz")
  → sql = 'SELECT * FROM products WHERE name LIKE ?'
  → executeQuery(sql, ['%nonexistent-product-xyz%'])
  → filters products → 0 matches → returns []
  → [].map(row => formatProduct(row)) → []
  → returns empty array ✓
```

### Test Suite (9 tests — all passing)

| # | Test | Validates |
|---|------|-----------|
| 1 | `searchProducts("mouse")` | Returns 1 result with correct name |
| 2 | `searchProducts("wireless")` | Returns 2 results |
| 3 | `searchProducts("mouse")` price | Price formatted as `"$29.99"` |
| 4 | `searchProducts("nonexistent-product-xyz")` | Returns empty array `[]` |
| 5 | `searchProducts("CABLE")` | Case-insensitive, returns 2 |
| 6 | `searchByCategory("electronics")` | Returns 4 results |
| 7 | `searchByCategory("toys")` | Unknown category returns empty `[]` |
| 8 | `getProductById(3)` | Returns correct product with category |
| 9 | `getProductById(999)` | Returns `null` for missing product |

**Current test run**: `9 passed, 0 failed`

---

## Bug Identification

### Already Fixed: Null Handling Crash (was CRITICAL)

**Status**: ✅ Fixed
**Original symptom**: `TypeError: Cannot read properties of null (reading 'map')` when searching for nonexistent products.

**Root cause was in `db.js`**: The original `executeQuery` returned `null` when no rows matched. The callers `searchProducts()` and `searchByCategory()` called `.map()` on the result without null-checking.

**How it was fixed**: `db.js` now always returns an array (empty `[]` for no matches), which is the standard database driver convention. This eliminates the null-check trap at the source.

### Already Fixed: SQL Injection Vulnerability (was CRITICAL)

**Status**: ✅ Fixed
**Original code** built SQL via string interpolation with untrusted user input:
```js
// BEFORE (vulnerable):
const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
```

**How it was fixed**: Both `product-search.js` and `db.js` now use parameterized queries with `?` placeholders. User input is passed as a separate `params` array and never interpolated into SQL strings:
```js
// AFTER (safe):
const sql = 'SELECT * FROM products WHERE name LIKE ?';
const rows = executeQuery(sql, ['%' + query + '%']);
```

### Already Fixed: Duplicated Formatting Logic

**Status**: ✅ Fixed
A shared `formatProduct(row, includeCategory)` helper was extracted, eliminating duplicated price formatting across all three functions.

### Remaining Issue 1 — No Input Validation

**Severity**: Low
**Location**: `src/product-search.js`, all three functions

None of the functions validate their inputs:
- `searchProducts(undefined)` → coerces to `"%undefined%"` pattern, returns `[]` (harmless but semantically wrong)
- `searchProducts("")` → matches `"%%"` pattern, returns **all 8 products** (may be unintended behavior for an empty search)
- `searchByCategory(null)` → coerces to `"null"` string, returns `[]` (harmless)
- `getProductById("abc")` → `Number("abc")` = `NaN`, returns `null` (handled gracefully)

### Remaining Issue 2 — No SQL Injection Test Coverage

**Severity**: Low
**Location**: `test/product-search.test.js`

The test suite covers functional correctness but has no tests for:
- SQL injection payloads (`'; DROP TABLE --`, `' OR '1'='1`)
- Special characters in search terms (quotes, wildcards `%` and `_`)
- Invalid input types (null, undefined, objects)

While the parameterized query approach prevents injection by design, regression tests would guard against future changes that might reintroduce interpolation.

### Remaining Issue 3 — `executeQuery` Regex Parsing is Fragile

**Severity**: Low (design limitation of in-memory simulation)
**Location**: `src/db.js`

The query engine uses regex to parse SQL and can only handle single-clause WHERE conditions. Compound queries like `WHERE category = ? AND price < ?` would silently return incorrect results. This is acceptable for an in-memory simulation but would need replacement with a real query engine in production.

---

## Fix Plan

Since the critical bugs (null handling and SQL injection) are already fixed and all 9 tests pass, the remaining improvements are optional hardening:

### Optional Fix 1: Add Input Validation

```js
function searchProducts(query) {
  if (typeof query !== 'string' || query.trim().length === 0) return [];
  // ... existing logic
}

function searchByCategory(category) {
  if (typeof category !== 'string' || category.trim().length === 0) return [];
  // ... existing logic
}

function getProductById(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;
  // ... existing logic
}
```

**Note**: Empty string validation for `searchProducts` would change behavior — currently returns all products. Whether this is desired depends on API requirements.

### Optional Fix 2: Add Security Regression Tests

```js
test('searchProducts handles SQL injection attempt safely', () => {
  const results = searchProducts("'; DROP TABLE products; --");
  assert(Array.isArray(results), 'Should return array, not crash');
  assert(results.length === 0, 'Injection payload should match nothing');
});

test('searchByCategory handles injection attempt safely', () => {
  const results = searchByCategory("electronics' OR '1'='1");
  assert(Array.isArray(results), 'Should return array');
  assert(results.length === 0, 'Injection should not bypass category filter');
});
```

### Optional Fix 3: Document `executeQuery` Limitations

Add JSDoc or README noting that the in-memory query engine only supports single-clause WHERE conditions and should be replaced with a real SQL engine (SQLite, Postgres) for production use.
