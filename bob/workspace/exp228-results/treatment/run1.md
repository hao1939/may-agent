# EXP-228 Treatment Run 1: queryBuilder.ts Bug Fix

## Bug

`searchProducts` accepts `query: string | null` but immediately calls `query.trim()` without a null check, causing `TypeError: Cannot read properties of null (reading 'trim')`.

Secondary issue: both functions interpolate user input directly into SQL strings, creating SQL injection vulnerabilities.

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

  if (!query) {
    return [];
  }

  const trimmed = query.trim();
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

## Explanation

1. **Null guard**: Added `if (!query) { return []; }` before `query.trim()`, preventing the TypeError.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and parameter arrays, eliminating SQL injection vulnerabilities in both functions.
