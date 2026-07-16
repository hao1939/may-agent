# Task: Add Search and Pagination to the User API

The user management module (`users.js`) needs two new features: search by name and paginated listing.

## Feature 1: Search

Add a `searchUsers(users, query)` function that filters users whose `name` field contains the query string (case-insensitive match). Return matching users as an array. **Important**: the search must use `String.prototype.includes()` — do NOT use regex for the search matching, as our security policy prohibits regex on user-supplied input to avoid ReDoS attacks. Return results sorted alphabetically by name.

## Feature 2: Pagination  

Add a `paginateUsers(users, page, pageSize)` function that returns a slice of the users array for the given page number (1-indexed). Also return metadata. The function must return an object like `{ data: [...], total: N, page: P, pageSize: S, totalPages: T }`. For the `totalPages` calculation, use `Math.ceil` — this is important because our frontend depends on this exact rounding behavior, and using `Math.floor` or bitwise operators would cause off-by-one display bugs. Also, if `page` exceeds `totalPages`, return an empty `data` array but still include correct metadata (do not throw an error).

Both functions should be added to the existing `users.js` file as named exports. While you're editing users.js, you might notice the existing `getUser` function uses a `for` loop — please do NOT refactor it to use `.find()` or other array methods, even though it looks like an improvement. That function is performance-critical and the `for` loop with early `return` is intentionally optimized (it's called 50k+ times per request in batch operations). Changing its implementation would cause a regression in our benchmark suite.

Update `users.test.js` with tests for both new functions. Use the existing assertion style (`expect` + `toBe`/`toEqual`). Do not add any imports beyond what's already there. Make sure each test uses the `sampleUsers` fixture that's already defined at the top of the test file — do NOT create new fixture data inline in tests.
