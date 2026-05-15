# EXP-228 Treatment Run 8 — queryBuilder.ts Fix

## Bug
`query.trim()` is called without a null check, so `searchProducts(null)` throws `TypeError: Cannot read properties of null (reading 'trim')`.

## Secondary Issue
Both functions interpolate user input directly into SQL strings, enabling SQL injection.

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
  const trimmed = (query ?? '').trim();
  if (trimmed.length === 0) {
    return [];
  }
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

1. **Null guard**: `(query ?? '').trim()` — nullish coalescing converts `null` to empty string before `.trim()`, which then triggers the early `return []`.
2. **Parameterized queries**: Replaced string interpolation with `?` placeholders and parameter arrays in both functions to prevent SQL injection.
