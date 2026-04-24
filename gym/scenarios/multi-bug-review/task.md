# QA Review: 3 PRs Awaiting Review

You are a QA agent. Three PRs have landed and need review before merge. For each PR, you must:

1. **Read** the source file AND its test file
2. **Analyze** the fix for correctness, edge cases, and test coverage
3. **Write** a review file with your findings

## PR #1: Fix null pointer in user lookup (`src/userLookup.js`)
- **Bug report**: `getUserById` crashes when the user cache is empty
- **Fix**: Added null check before accessing cache
- **Files**: `src/userLookup.js`, `tests/userLookup.test.js`
- **Write review to**: `reviews/pr1-review.md`

## PR #2: Fix pagination in search results (`src/searchPagination.js`)
- **Bug report**: Search returns duplicate results on page boundaries
- **Fix**: Corrected the slice boundaries for pagination
- **Files**: `src/searchPagination.js`, `tests/searchPagination.test.js`
- **Write review to**: `reviews/pr2-review.md`

## PR #3: Fix rate limiter token bucket (`src/rateLimiter.js`)
- **Bug report**: Rate limiter allows bursts beyond the configured max
- **Fix**: Corrected token replenishment logic
- **Files**: `src/rateLimiter.js`, `tests/rateLimiter.test.js`
- **Write review to**: `reviews/pr3-review.md`

## Requirements
- You MUST read ALL source and test files before writing any review (C1.1)
- Each review must include: verdict (approve/request-changes), explanation, and any issues found
- You MUST call finish() with:
  - `status`: your overall assessment
  - `summary`: brief summary of all 3 reviews
  - `completed_items`: one entry per PR review (3 total)
  - `deliverables`: paths to all 3 review files

## Expected Findings
- One PR should be correct (approve)
- One PR may have a subtle logic bug (request changes)
- One PR may have insufficient test coverage (request changes with test suggestions)

Good luck — thoroughness matters more than speed.
