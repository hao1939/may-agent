# Product Search Service — Analysis

## Data Flow

### Module Overview

| File | Role | Exports |
|------|------|---------|
| `src/db.js` | In-memory database simulation + SQL-like query engine | `executeQuery(sql, params)` |
| `src/product-search.js` | Business logic — builds SQL, calls DB, formats results | `searchProducts(query)`, `searchByCategory(category)`, `getProductById(id)` |
| `test/product-search.test.js` | 9 tests covering all three search functions | (test runner) |

### Database Layer (`src/db.js`)

- **Data**: 8 hardcoded product objects with fields: `id`, `name`, `price`, `category`
- **`executeQuery(sql, params=[])`**: Accepts a SQL string with `?` placeholders and a params array. Replaces `?` with bound values, then uses regex to parse WHERE clauses (LIKE, category =, id =) and filter the in-memory product array.
- **Return behavior**: Always returns an array (the filtered `results` array). If no matches, returns an empty array `[]`. This is a consistent return type — no null returns.

### Business Logic Layer (`src/product-search.js`)

Three exported functions + one helper:

- **`formatProduct(row)`** — Shared helper that formats a product row: extracts `id`, `name`, and formats `price` with `$` prefix and `.toFixed(2)`.

- **`searchProducts(query)`**:
  1. Type-checks input (returns `[]` if not a string)
  2. Builds parameterized SQL: `SELECT * FROM products WHERE name LIKE ?`
  3. Calls `executeQuery(sql, [`%${query}%`])` — user input is in the params array, not the SQL string
  4. Null/empty guard: `if (!rows || rows.length === 0) return []`
  5. Maps through `formatProduct` and returns formatted results

- **`searchByCategory(category)`**: Same pattern as above but with `WHERE category = ?`

- **`getProductById(id)`**: Same pattern but returns a single object (or `null`), includes `category` in output

**Call chain for a matching search** (e.g., `searchProducts('mouse')`):
```
searchProducts('mouse')
  → sql = "SELECT * FROM products WHERE name LIKE ?"
  → executeQuery(sql, ['%mouse%'])
  → db.js replaces ? with '%mouse%', regex matches LIKE pattern
  → filters: [{id:1, name:'Wireless Mouse', price:29.99, ...}]
  → rows.map(formatProduct) → [{id:1, name:'Wireless Mouse', price:'$29.99'}]
  → return formatted array ✓
```

**Call chain for a non-matching search** (e.g., `searchProducts('nonexistent-product-xyz')`):
```
searchProducts('nonexistent-product-xyz')
  → sql = "SELECT * FROM products WHERE name LIKE ?"
  → executeQuery(sql, ['%nonexistent-product-xyz%'])
  → db.js filters: no matches → returns []
  → rows.length === 0 → return [] ✓ (handled by null guard)
```

### Test Coverage Summary

| # | Test | Status | What it exercises |
|---|------|--------|-------------------|
| 1 | searchProducts("mouse") returns 1 result | ✅ PASS | Happy path, single match |
| 2 | searchProducts("wireless") returns 2 results | ✅ PASS | Multiple matches |
| 3 | searchProducts("mouse") price = "$29.99" | ✅ PASS | Price formatting |
| 4 | searchProducts("nonexistent-product-xyz") returns [] | ✅ PASS | No-match case |
| 5 | searchProducts("CABLE") returns 2 results | ✅ PASS | Case insensitivity |
| 6 | searchByCategory("electronics") returns 4 | ✅ PASS | Category happy path |
| 7 | searchByCategory("toys") returns [] | ✅ PASS | Unknown category |
| 8 | getProductById(3) returns Desk Lamp | ✅ PASS | ID lookup happy path |
| 9 | getProductById(999) returns null | ✅ PASS | Missing ID |

All 9 tests pass.

---

## Bug Identification

### Issue 1 (CRITICAL — Security): SQL Injection vulnerability via regex-based query engine

**Location**: `src/db.js`, lines 30-36 (the `boundSql` construction)  
**Severity**: Critical — SQL injection risk  
**Root cause**: Although `product-search.js` correctly uses parameterized queries with `?` placeholders, the `executeQuery()` function in `db.js` implements parameter binding by **string interpolation** — it replaces each `?` with the literal value wrapped in quotes:

```js
const boundSql = sql.replace(/\?/g, () => {
    const value = params[paramIndex++];
    if (typeof value === 'number') return String(value);
    return `'${String(value)}'`;  // ← No escaping of quotes/special chars in value!
});
```

This means if a user searches for a string containing a single quote (e.g., `O'Brien` or the malicious `'; DROP TABLE products; --`), the bound value would be:
```
'%'; DROP TABLE products; --%'
```

The regex-based parser would then fail unpredictably or, in a real database, execute arbitrary SQL. The binding does **zero escaping** of the value — no quote escaping, no special character handling.

**Impact**: While the in-memory regex engine limits exploitability today, the code comment says "In production this would be backed by SQLite/Postgres." When that migration happens, this interpolation-based binding becomes a real SQL injection vector. The task explicitly states this handles "user-supplied search queries from our public API."

**Additionally**: The `searchProducts()` function constructs the LIKE parameter as `` `%${query}%` `` — if the query contains SQL LIKE wildcards (`%` or `_`), those would be interpreted as pattern characters, causing unexpected matches. This is a logic bug, not a security vulnerability, but could leak data.

### Issue 2 (Medium — Robustness): `formatProduct` crashes on malformed rows

**Location**: `src/product-search.js`, line 16  
**Severity**: Medium  
**Description**: `formatProduct` calls `row.price.toFixed(2)` — if a row has `price: null`, `price: undefined`, or `price: 'string'`, this will throw a `TypeError`. There's no defensive check. Currently the hardcoded data is clean, but any future data source could have malformed rows.

### Issue 3 (Medium — Design): `executeQuery()` regex matching is fragile

**Location**: `src/db.js`, lines 38-54  
**Severity**: Medium  
**Description**: The SQL parser uses simple regex patterns that can't handle:
- Multiple WHERE conditions (AND/OR)
- Quoted values containing special regex characters
- NULL comparisons
- Nested queries

This is expected for an in-memory simulation, but the lack of proper escaping in the `boundSql` construction (Issue 1) means even the simple cases can break with special characters in user input.

### Issue 4 (Low — Code Quality): No input sanitization for LIKE wildcards

**Location**: `src/product-search.js`, line 32  
**Severity**: Low  
**Description**: The `%${query}%` parameter doesn't escape LIKE special characters (`%`, `_`). A search for `%` would match all products, and `_` would match any single character. In a real database, this would need `ESCAPE` clause handling.

### Issue 5 (Low — Testing): No security or edge-case tests

**Location**: `test/product-search.test.js`  
**Severity**: Low  
**Description**: No tests for:
- SQL injection attempts (e.g., `'; DROP TABLE products; --`)
- Special characters in search queries (quotes, backslashes, LIKE wildcards)
- Empty string searches
- Very long input strings

---

## Fix Plan

### Fix 1 (Priority: CRITICAL) — Properly escape values in `db.js` parameter binding

The `boundSql` construction in `executeQuery()` must escape single quotes in parameter values to prevent SQL injection:

```js
// In db.js, update the boundSql construction:
const boundSql = sql.replace(/\?/g, () => {
    const value = params[paramIndex++];
    if (typeof value === 'number') return String(value);
    // Escape single quotes to prevent SQL injection
    return `'${String(value).replace(/'/g, "''")}'`;
});
```

Alternatively (and preferably), refactor `executeQuery()` to work with the raw params directly instead of interpolating into a SQL string and then re-parsing. The params could be used directly in the filter functions:

```js
// Better approach: use params directly in filter logic instead of building boundSql
function executeQuery(sql, params = []) {
    let results = [...products];
    let paramIndex = 0;
    const nextParam = () => params[paramIndex++];

    if (sql.includes('LIKE ?')) {
        const pattern = String(nextParam()).replace(/%/g, '').toLowerCase();
        results = results.filter(p => p.name.toLowerCase().includes(pattern));
    } else if (sql.includes('category = ?')) {
        const cat = String(nextParam()).toLowerCase();
        results = results.filter(p => p.category === cat);
    } else if (sql.includes('id = ?')) {
        const id = Number(nextParam());
        results = results.filter(p => p.id === id);
    }
    return results;
}
```

This eliminates the interpolation step entirely — params never enter the SQL string.

### Fix 2 (Priority: RECOMMENDED) — Escape LIKE wildcards in search input

In `searchProducts()`, escape `%` and `_` characters in the user's query before passing to the LIKE parameter:

```js
function searchProducts(query) {
    if (typeof query !== 'string') return [];
    const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const sql = `SELECT * FROM products WHERE name LIKE ? ESCAPE '\\'`;
    const rows = executeQuery(sql, [`%${escaped}%`]);
    if (!rows || rows.length === 0) return [];
    return rows.map(formatProduct);
}
```

### Fix 3 (Priority: RECOMMENDED) — Add defensive checks in `formatProduct`

```js
function formatProduct(row) {
    return {
        id: row.id,
        name: row.name,
        price: typeof row.price === 'number' ? `$${row.price.toFixed(2)}` : '$0.00',
    };
}
```

### Fix 4 (Priority: LOW) — Add security tests

Add tests for SQL injection attempts and special characters:

```js
test('searchProducts handles SQL injection attempt safely', () => {
    const results = searchProducts("'; DROP TABLE products; --");
    assert(Array.isArray(results), 'Should return an array');
});

test('searchProducts handles single quotes in input', () => {
    const results = searchProducts("O'Brien");
    assert(Array.isArray(results), 'Should return an array');
});
```
