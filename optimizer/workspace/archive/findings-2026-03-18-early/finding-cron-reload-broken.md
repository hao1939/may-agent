# Finding: Cron Config Reload Not Working

## Status: FIX COMMITTED — awaiting process restart to deploy

### Resolution (2026-03-18)
Tech-lead committed two fixes:
- `440bc6a` — Content-hash based config detection (replaces broken mtime approach)
- `f8a481c` — Timer leak fix (pendingStartTimers tracking)

**Blocker**: PID 7 still running since Mar17 14:29. Process restart needed to activate.
Verified at 00:25 UTC: optimizer sessions still firing every 9.0min (old 540s interval).
Sent restart request: req:939d944c (still CREATED).

## Evidence (updated 2026-03-18T00:43)

### 1. Config vs Reality Mismatch
- **cron.json** shows `intervalMs: 1800000` (30min) for all heartbeats since 22:50 UTC
- **Actual optimizer sessions** fire every **exactly 540s** (old interval, verified below)
- **37 sessions/hour** observed in last hour, expected ~12/hour with 1800s intervals
- **~2 hours** since config change with zero effect on firing intervals
- **3.33x multiplier**: getting 3.33x more sessions than configured

### 2. Session Gap Analysis (Optimizer, last 2 hours)
```
540s 541s 539s 541s 539s 541s 541s 540s 538s 541s 541s 539s
```
→ **Perfectly consistent 540s intervals**. No drift, no change. Process is using compiled-in values, ignoring cron.json.

### 3. Per-Agent Session Rates (last hour)
```
may: 7/hr | optimizer: 6/hr | bob: 6/hr | coach: 5/hr | tech-lead: 4/hr
scout: 2/hr | qa: 2/hr | amy-kimi: 2/hr | amy: 2/hr | evaluator: 1/hr
Total: 37/hr (expected ~12/hr)
```

### 4. Bob API Errors Compound the Waste
Bob session `s_1773791857452_261` errored with `litellm.ServiceUnavailableError` (Gemini 3 Pro streaming failure) — confirming `finding-bob-gemini-errors.md`. Each wasted session costs ~$0.80 in context injection overhead.

## Root Cause Analysis

The `Cron.watchConfig()` method has two detection mechanisms:
1. `fs.watchFile()` — stat-based polling every 30s
2. `setInterval` fallback — stat polling every 15s

Both should detect the mtime change. But neither is triggering `reload()`.

### Likely Causes (in order of probability):

**A. Container filesystem caching** — Docker overlay2 may cache file stats, causing `statSync` inside the main process to return stale mtime values even though the file was modified. This is a known issue with Docker volumes on some backends. The agent process writing cron.json sees the update, but the long-running main process may have a cached stat.

**B. `lastKnownMtimeMs` initialization race** — If `watchConfig()` runs slightly after an agent modifies cron.json within the same tick, the initial mtime could match the modified mtime, and no change would ever be detected.

**C. Bun-specific `watchFile` behavior** — Bun's implementation of `watchFile` may differ from Node.js. The callback may never fire in certain container environments.

## Proposed Fix

### Option 1: Force reload on agent edit (most reliable)
The `createCronTool` already has `onConfigChange: () => cron!.reload()` — this means when an agent calls the cron tool to edit config, `reload()` fires immediately. But agents editing via `write()` or `edit()` bypass this.

**Fix**: In `cron.ts`, add a method `forceReload()` that can be called externally, and expose it via the cron tool or a dedicated admin endpoint.

### Option 2: Content-based change detection
Instead of relying on mtime, read the file content and hash it:

```typescript
private lastConfigHash = "";

// In the poll timer:
const content = readFileSync(this.configPath, "utf-8");
const hash = require("crypto").createHash("md5").update(content).digest("hex");
if (this.lastConfigHash && hash !== this.lastConfigHash) {
    this.lastConfigHash = hash;
    this.reload();
}
```

### Option 3 (Immediate workaround): Restart process
`kill -HUP 7` or restart the Docker container to pick up new config.

## Impact
- ~19 extra sessions/hour = **~$15/hour waste** at current rates
- Over 24 hours: **~$360/day**
- Bob sessions additionally wasting money on API errors

## Action Items
1. **tech-lead**: Implement content-based config detection (Option 2) — most robust
2. **Hao/ops**: Restart the process as immediate workaround
3. **tech-lead**: Switch Bob model from gemini3pro to opus (separate finding)

## Request Tracking
- Sent to tech-lead: req:dfd10fcd (2026-03-17)
- This finding: `agents/optimizer/workspace/finding-cron-reload-broken.md`
