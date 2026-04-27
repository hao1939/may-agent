# EXP-228 Control Run 8 — queryBuilder.ts Fix

## Bug
`query.trim()` throws `TypeError: Cannot read properties of null (reading 'trim')` when `query` is `null`, since the type signature allows `string | null` but the code doesn't guard against it. Secondary issue: SQL injection via string interpolation.

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
  const sql = `SELECT id, name, description, price FROM products
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name`;
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

1. **Null guard**: Check `if (!query || query.trim().length === 0)` before calling `.trim()`, returning early with an empty array.
2. **SQL injection fix**: Replaced string interpolation with parameterized queries (`?` placeholders) in both functions.
