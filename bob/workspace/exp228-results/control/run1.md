# EXP-228 Control Run 1

## Bug
`searchProducts` crashes when `query` is `null` because `null.trim()` throws.

## Additional Issue
Both functions have SQL injection vulnerabilities via string interpolation.

## Fixed `src/search/queryBuilder.ts`

```typescript
import { getDb } from '../db/connection';

interface SearchResult { id: number; name: string; description: string; price: number; }

export async function searchProducts(query: string | null): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) { return []; }
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
    const pattern = `%${query}%`;
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(pattern, pattern);
  }
  sql += ' ORDER BY name';
  const results = await db.all(sql, params);
  return results as SearchResult[];
}
```

## Changes
1. **Null guard**: Check `query` is truthy before calling `.trim()`, return early if null/empty.
2. **SQL injection fix**: Replaced string interpolation with parameterized queries in both functions.
