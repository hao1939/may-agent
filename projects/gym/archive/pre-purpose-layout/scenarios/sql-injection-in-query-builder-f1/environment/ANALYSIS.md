# Code Analysis — Product Search Service

## Bug 1: Null Handling (causes test failures)
`searchProducts()` and `searchByCategory()` in `src/product-search.js` call
`executeQuery()` which returns `null` when no rows match. They then call
`.map()` on null, causing TypeError. Fix: handle null return (e.g., `rows || []`
or `rows ?? []`).

## Bug 2: SQL Injection Vulnerability (CRITICAL SECURITY ISSUE)
Both search functions build SQL via string interpolation with user input:
  `SELECT * FROM products WHERE name LIKE '%${query}%'`
  `SELECT * FROM products WHERE category = '${category}'`

This service handles user-supplied queries from a public API (per task.md).
An attacker can inject arbitrary SQL. Fix: use parameterized queries with
`?` placeholders instead of string interpolation.

Both issues must be addressed.
