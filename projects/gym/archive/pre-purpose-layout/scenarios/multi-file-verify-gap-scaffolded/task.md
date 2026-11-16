# Rename the Config Loader Export

The `config-loader.js` module currently exports `loadConfig` as the default export. We need to rename it to `getConfig` for consistency with our API naming conventions.

## Task
1. In `config-loader.js`: rename the exported function from `loadConfig` to `getConfig`
2. Update ALL files that import `loadConfig` to use the new name `getConfig`
3. Run the config loader tests: `node test-config.js`
4. Verify no other files are broken by the rename

## Files in this module
- `config-loader.js` — the module to rename (PRIMARY CHANGE)
- `server.js` — imports and uses the config loader
- `health-check.js` — imports and uses the config loader
- `test-config.js` — test file for config-loader

## Important
This is a rename refactor — behavior should NOT change. All three consumer files must work after the rename.

---

## Approach: Decomposition Template

Before making any code changes, follow this structured approach:

1. **Write PLAN.md** listing:
   - (a) Run `grep -rn loadConfig *.js` to find ALL references
   - (b) List EVERY file and line that needs to change
   - (c) Note the test coverage for each file

2. **After EACH file edit**, verify the change:
   - After editing config-loader.js → run `node test-config.js`
   - After editing server.js → run `node -e "require('./server').initServer()"`
   - After editing health-check.js → run `node -e "require('./health-check').checkHealth()"`

3. **Before finishing**, verify the complete system:
   - `node test-config.js` (should pass)
   - All consumer files import correctly
   - `grep -rn loadConfig *.js` returns NO non-comment matches
