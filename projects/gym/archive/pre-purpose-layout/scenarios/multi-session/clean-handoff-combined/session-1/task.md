Build a string utility module for a Node.js project.

Create `src/string-utils.js` with these functions:
1. `capitalize(str)` — capitalizes the first letter, lowercases the rest
2. `slugify(str)` — converts to URL-friendly slug (lowercase, hyphens for spaces, strip non-alphanumeric)
3. `truncate(str, maxLen, suffix)` — truncates with ellipsis (default suffix "...")
4. `camelToKebab(str)` — converts camelCase to kebab-case
5. `countWords(str)` — counts words in a string (split on whitespace)

Also create `src/string-utils.test.js` with at least 3 tests per function (15+ total tests).

Requirements:
- Pure functions, no dependencies
- Handle edge cases: empty string, null/undefined input, very long strings
- Use JSDoc comments for each function
- Export all functions via module.exports
