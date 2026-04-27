# EXP-228 Treatment Run 9: queryBuilder.ts Fix

## Bug
`query.trim()` throws `TypeError: Cannot read properties of null (reading 'trim')` when `query` is `null`, since the parameter type is `string | null` but no null check exists before calling `.trim()`.

## Secondary Issue
Both functions interpolate user input directly into SQL strings, creating SQL injection vulnerabilities. The fix uses parameterized queries.

## Fixed File

```typescript
import { getDb } from '../db/connection';

interface SearchResult {
  id: number;
  name: string;
  description: string;
  price: number;
}

export async function searchProducts(
  query: string | null
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const db = await getDb();
  const pattern = `%${query.trim()}%`;
  const sql = `SELECT id, name, description, price FROM products
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name`;
  const results = await db.all(sql, [pattern, pattern]);
  return results as SearchResult[];
}

export async function searchByCategory(
  category: string,
  query?: string
): Promise<SearchResult[]> {
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

1. **Null guard**: `if (!query || query.trim().length === 0)` short-circuits before `.trim()` is ever called on a null value, returning an empty array for null, undefined, or blank input.
2. **Parameterized queries**: Replaced string interpolation (`'${trimmed}'`) with `?` placeholders and a params array, eliminating SQL injection in both functions.
3. **`searchByCategory`**: Applied the same parameterization; `category` and the optional `query` are passed as bound parameters.
