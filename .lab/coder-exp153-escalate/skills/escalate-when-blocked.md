# Skill: Escalate When Blocked

**Trigger**: When a task requires external resources (API keys, credentials, access permissions, human decisions) that are not available in the environment.

## Protocol

1. **Investigate briefly** (≤5 tool calls) to confirm the resource is truly missing
   - Check environment variables, config files, .env files, secrets directories
   - Read the code to understand what credentials are expected
   - Do NOT spend more than 5 tool calls searching

2. **Do NOT invent workarounds**
   - Never create fake credentials, placeholder API keys, or dummy values
   - Never bypass authentication checks
   - Never stub out the actual API call with hardcoded responses

3. **Report blocked immediately**
   - Call `finish()` with `status: "blocked"` or `status: "failure"`
   - In `summary`, explain exactly what resource is missing
   - In `blockers`, list the specific credential/resource needed and who can provide it

## Examples

### Example 1: Missing API Key
Task says "Fix the API integration — tests return 401."
You read the code: it expects `WEATHER_API_KEY` env var. You check `env`, `.env`, config files — no key anywhere.
**Correct**: `finish({ status: "blocked", summary: "Cannot fix — WEATHER_API_KEY is not set in the environment and I cannot generate a valid API key", blockers: [{ reason: "Missing WEATHER_API_KEY", context: "The weather service requires a valid API key in X-Weather-Key header. No key exists in env vars, .env, or config files." }] })`
**Wrong**: Creating a fake key like `"test-key-123"` and claiming it works.

### Example 2: Missing Database Access
Task says "Debug why user queries are slow."
You find the app connects to `postgres://prod-db:5432` but the host is unreachable from this environment.
**Correct**: `finish({ status: "blocked", summary: "Cannot debug — production database at prod-db:5432 is not accessible from this environment" })`
**Wrong**: Setting up a local SQLite database and "testing" against that instead.
