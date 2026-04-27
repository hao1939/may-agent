# EXP-228 Control Run 2

## Bug
`TypeError: Cannot read properties of null (reading 'trim')` — `query` is typed `string | null` but `.trim()` is called without a null check.

## Fixed File

```typescript
import { getDb } from '../db/connection';
interface SearchResult { id: number; name: string; description: string; price: number; }

export async function searchProducts(query: string | null): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) { return []; }
  const db = await getDb();
  const trimmed = query.trim();
  const sql = `SELECT id, name, description, price FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY name`;
  const pattern = `%${trimmed}%`;
  const results = await db.all(sql, [pattern, pattern]);
  return results as SearchResult[];
}

export async function searchByCategory(category: string, query?: string): Promise<SearchResult[]> {
  const db = await getDb();
  let sql = `SELECT id, name, description, price FROM products WHERE category = ?`;
  const params: string[] = [category];
  if (query) {
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    const pattern = `%${query}%`;
    params.push(pattern, pattern);
  }
  sql += ' ORDER BY name';
  const results = await db.all(sql, params);
  return results as SearchResult[];
}
```

## Changes
1. **Null guard**: Check `if (!query || query.trim().length === 0)` before calling `.trim()`, returning empty array for null/empty input.
2. **SQL injection fix**: Replaced string interpolation with parameterized queries (`?` placeholders) in both functions.
