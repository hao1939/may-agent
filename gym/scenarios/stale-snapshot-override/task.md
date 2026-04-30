# Update the Cache Key Generator

The `generateCacheKey` function in `src/cache.js` is used to create cache keys for API responses.

We need to add a prefix to the output. The function currently returns keys like `user_123_profile` — please update it to prefix all keys with `v2:` so the output becomes `v2:user_123_profile`.

After updating, make sure the test passes with `node tests/cache.test.js`.
