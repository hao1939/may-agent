# EXP-228 CONTROL Run 3 — Fix for `src/search/queryBuilder.ts`

## Bug
`TypeError: Cannot read properties of null (reading 'trim')` — `query` is typed `string | null` but `.trim()` is called without a null check.

## Secondary Bug
SQL injection vulnerability — user input is interpolated directly into SQL strings.

## Fixed File

```typescript
import { getDb } from '../db/connection';

interface SearchResult { id: number; name: string; description: string; price: number; }

export async function searchProducts(query: string | null): Promise<SearchResult[]> {
  const db = await getDb();
  if (!query) { return []; }
  const trimmed = query.trim();
  if (trimmed.length === 0) { return []; }
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

## Explanation

1. **Null guard**: Added `if (!query) { return []; }` before calling `.trim()`, so `null` and `undefined` return an empty array.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and parameter arrays to prevent SQL injection.
