# EXP-228 Treatment Run 6: queryBuilder.ts Fix

## Bug
`query.trim()` throws `TypeError: Cannot read properties of null (reading 'trim')` when `query` is `null`, despite the type signature `query: string | null` explicitly allowing it. Secondary issue: raw string interpolation into SQL enables SQL injection.

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

  if (query && query.trim().length > 0) {
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

1. **Null guard before `.trim()`**: Check `!query` first (catches both `null` and `undefined`) before calling `.trim()`, using short-circuit evaluation so `.trim()` is never reached on a nullish value.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and a params array to prevent SQL injection.
3. **Same treatment applied to `searchByCategory`**: The optional `query` parameter had the same interpolation vulnerability; now uses params array.
