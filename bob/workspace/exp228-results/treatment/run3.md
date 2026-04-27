# EXP-228 Treatment Run 3 — queryBuilder.ts Fix

## Bug
`query.trim()` throws `TypeError: Cannot read properties of null (reading 'trim')` when `query` is `null`, since the parameter type `string | null` permits null but the code dereferences it unconditionally.

Secondary issue: string interpolation into SQL creates SQL injection vulnerabilities.

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

## Changes

1. **Null guard** — early return `[]` before calling `.trim()` when `query` is null/undefined/empty.
2. **Parameterized queries** — replaced string interpolation with `?` placeholders to eliminate SQL injection in both functions.
