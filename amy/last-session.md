# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777357810375_0
- **Status:** done
- **When:** 2026-04-28T06:30:54.813Z
- **Duration:** 44s

## What Happened
The bug: `app.js` requires `config` before calling `registry.init()`. When `config.js` loads, it tries to register plugins, but `registry.register()` silently ignores them because `initialized` is false.

Fix: move `registry.init()` before the config import.
