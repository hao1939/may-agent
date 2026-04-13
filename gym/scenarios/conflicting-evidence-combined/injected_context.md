## Example: How to reconcile conflicting configuration sources

In a previous project, an API service was returning 500 errors. Investigation revealed:
- **docker-compose.yml** said Redis was on port 6379
- **config/production.json** said Redis was on port 6380
- **src/cache.ts** had a hardcoded fallback: `const REDIS_PORT = process.env.REDIS_PORT || 6379`
- **Error log** showed "Connection refused on port 6379"

The engineer systematically inventoried ALL config sources before making any change:

1. Created `fix-summary.md` with a table listing every source and its value
2. Identified that docker-compose was authoritative (Redis actually runs on 6380 after a migration)
3. Found that `src/cache.ts` hardcode was overriding the config file
4. Fixed the code to read from config, updated docker-compose docs
5. Documented which source was stale and why

**Key lesson**: When multiple sources disagree, check ALL of them before deciding which is correct. The error log tells you what IS happening; the newest config file usually tells you what SHOULD happen; hardcoded values in code are the most common source of stale overrides.
