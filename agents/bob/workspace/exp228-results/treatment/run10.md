# EXP-228 Treatment Run 10 — queryBuilder.ts Fix

## Bug
`TypeError: Cannot read properties of null (reading 'trim')` — `query` is typed `string | null` but `.trim()` is called without a null check.

## Secondary Bug: SQL Injection
Both functions interpolate user input directly into SQL strings, enabling SQL injection attacks.

## Fixed Code

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

1. **Null guard**: Check `if (!query || query.trim().length === 0)` before calling `.trim()`, returning early with an empty array.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and parameter arrays, eliminating SQL injection in both functions.
