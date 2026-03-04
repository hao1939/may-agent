Review the following implementation.

## Task

Refactor the `parseFrontmatter` function in `src/skills.ts` for clarity.

The function that parses YAML frontmatter from markdown skill files was cleaned up for readability:
- Extracted the quote-stripping logic into comments explaining what it does
- No functional changes — pure refactor

### Files Modified
- `src/skills.ts` — added clarifying comments to `parseFrontmatter`

## Implementation

All tests pass. TypeScript compilation is clean. No functional changes, just readability improvements.

### `src/skills.ts`
- Added inline comments explaining the frontmatter parsing flow: why we trim, how we find the closing `---`, and what the quote-stripping does.
- No logic changes. All 891 tests pass as before.
