# EXP-228 CONTROL Run 6: queryBuilder.ts Null Safety & SQL Injection Fix

## Bug
`TypeError: Cannot read properties of null (reading 'trim')` — `query` is typed `string | null` but `.trim()` is called without a null check.

## Secondary Bug
Both functions interpolate user input directly into SQL strings, creating SQL injection vulnerabilities.

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
  if (!query) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const db = await getDb();
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

1. **Null guard**: Check `if (!query)` before calling `.trim()`, returning early with an empty array for null/undefined/empty input.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and parameter arrays, eliminating SQL injection in both functions.
3. **Deferred `getDb()`**: Moved the database connection call after the early return so we don't open a connection unnecessarily when query is null.
