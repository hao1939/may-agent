# EXP-228 Treatment Run 4 — queryBuilder.ts Fix

## Bug
`query.trim()` throws `TypeError: Cannot read properties of null (reading 'trim')` when `query` is `null`, despite the parameter type `string | null` indicating null is expected.

Secondary issue: SQL injection via string interpolation.

## Fixed File

```typescript
import { getDb } from '../db/connection';

interface SearchResult {
  id: number;
  name: string;
  description: string;
  price: number;
}

export async function searchProducts(query: string | null): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const db = await getDb();
  const trimmed = query.trim();
  const pattern = `%${trimmed}%`;
  const sql = `SELECT id, name, description, price FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY name`;
  const results = await db.all(sql, [pattern, pattern]);
  return results as SearchResult[];
}

export async function searchByCategory(category: string, query?: string): Promise<SearchResult[]> {
  const db = await getDb();
  const params: string[] = [category];
  let sql = `SELECT id, name, description, price FROM products WHERE category = ?`;

  if (query) {
    const pattern = `%${query.trim()}%`;
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(pattern, pattern);
  }

  sql += ' ORDER BY name';
  const results = await db.all(sql, params);
  return results as SearchResult[];
}
```

## Explanation

1. **Null guard before `.trim()`** — check `!query` first (catches both `null` and `undefined`), short-circuiting before any method call. Returns early with an empty array.
2. **Parameterized queries** — replaced string interpolation (`'${trimmed}'`) with `?` placeholders to eliminate SQL injection. Same fix applied to `searchByCategory`.
