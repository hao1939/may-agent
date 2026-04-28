# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777357855159_0
- **Status:** done
- **When:** 2026-04-28T06:31:41.319Z
- **Duration:** 46s

## What Happened
The bug: `app.js` requires `config` before calling `registry.init()`, so config's `register()` calls are silently dropped (registry not initialized yet).
