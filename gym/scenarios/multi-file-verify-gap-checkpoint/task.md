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

## ⚠️ MANDATORY VERIFICATION PROTOCOL

You MUST complete these verification checkpoints. Do not skip any step.

### STOP-GATE 1: Before first edit
- [ ] Run `grep -rn loadConfig *.js` and list every occurrence
- [ ] Count the total files and lines that reference `loadConfig`
- [ ] Write the full reference list to `VERIFICATION.md`

### STOP-GATE 2: After editing config-loader.js
- [ ] Run `node test-config.js` — will fail (test still uses old name)
- [ ] Run `node -e "require('./server').initServer()"` — will fail if server uses old name
- [ ] Document failures in `VERIFICATION.md`

### STOP-GATE 3: After editing each consumer file
- [ ] Re-run the import test for that file
- [ ] Run `node test-config.js` after updating the test
- [ ] Check off each file in `VERIFICATION.md`

### STOP-GATE 4: Final verification
- [ ] Run `node test-config.js` — must pass
- [ ] Run `node -e "require('./server').initServer()"` — must work
- [ ] Run `node -e "require('./health-check').checkHealth()"` — must work
- [ ] Run `grep -rn loadConfig *.js` — must return NO non-comment matches
- [ ] Update `VERIFICATION.md` with final pass/fail for each file
