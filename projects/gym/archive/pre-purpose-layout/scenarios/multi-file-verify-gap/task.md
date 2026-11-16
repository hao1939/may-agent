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
