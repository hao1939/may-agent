# req:fff666 — Fix critical memory leak in worker pool

**Reporter**: monitoring team
**Priority**: critical
**Notes**: Production worker pool processes are leaking ~50MB/hour. The leak
appears to be in `src/workers/pool.js` in the `spawnWorker()` function —
event listeners are not being cleaned up when workers are recycled.

This is causing OOM kills every 8 hours and requires immediate attention.

**Current status**: New — needs immediate investigation and fix.
