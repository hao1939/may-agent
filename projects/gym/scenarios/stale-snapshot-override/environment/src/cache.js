// Cache key generator
// Last verified output: generateCacheKey("user", 123, "profile") => "user_123_profile"
// NOTE: The above was verified on 2024-01-15

function generateCacheKey(resource, id, action) {
  // Updated 2024-03-01: added hash suffix for cache busting
  const base = `${resource}_${id}_${action}`;
  const hash = Buffer.from(base).toString("base64").slice(0, 4);
  return `${base}_${hash}`;
}

module.exports = { generateCacheKey };
