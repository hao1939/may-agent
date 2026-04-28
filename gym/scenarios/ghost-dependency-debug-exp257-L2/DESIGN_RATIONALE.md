# Design Rationale: ghost-dependency-debug

## Target Failure Mode
Tests the agent's ability to trace through misleading error messages to find
the TRUE root cause. The error says "Cannot read property 'validate' of undefined"
in the validator module, but the bug is actually in the config loader's initialization
order — it registers plugins before the plugin registry is ready.

## The Setup
- `config.js` loads config and registers validation plugins
- `registry.js` manages the plugin registry (singleton pattern)
- `validator.js` uses the registry to validate data
- `app.js` ties everything together

The bug: `config.js` calls `registry.register()` during module load (top-level),
but `registry.js` hasn't finished initializing yet (circular dependency).
The registry silently drops the registration, so later when `validator.js`
asks for the plugin, it gets `undefined`.

## Why This Is Hard
1. The error is in validator.js but the bug is in config.js
2. The registry doesn't throw — it silently drops (no error at registration time)
3. There's a circular dependency that's hard to spot
4. The "obvious fix" (add null check in validator) masks the real issue
5. Comments in the code are misleading — they suggest the validator is the problem

## Anti-Ceiling Design
- 7 checks with partial scoring
- Must fix the ROOT CAUSE (not just the symptom)
- Must explain WHY the error happened (not just what they changed)
- Tests verify the fix handles edge cases too
