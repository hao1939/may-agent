# EXP-228 Control Run 10 — queryBuilder.ts Fix

## Bug
`TypeError: Cannot read properties of null (reading 'trim')` — `query` parameter typed as `string | null` but `.trim()` called without null check.

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
  const db = await getDb();

  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmed = query.trim();
  const sql = `SELECT id, name, description, price FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY name`;
  const pattern = `%${trimmed}%`;
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

1. **Null guard (primary bug):** Added `if (!query || query.trim().length === 0)` check before calling `.trim()`, returning an empty array for null/empty input.
2. **SQL injection fix:** Replaced string interpolation in SQL with parameterized queries (`?` placeholders) in both functions. The original code was vulnerable to SQL injection via `query` and `category`.
