# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777357765667_0
- **Status:** done
- **When:** 2026-04-28T06:30:10.023Z
- **Duration:** 44s

## What Happened
The bug: `config.js` registers plugins during module load, but `app.js` calls `registry.init()` *after* requiring config. So `register()` silently drops all plugins because `initialized` is false.

Fix: move `registry.init()` before the imports that trigger registration.
