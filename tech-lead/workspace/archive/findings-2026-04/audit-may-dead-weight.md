# Audit: may.ts Dead Weight

**File**: `src/app/may.ts` (~580 lines)  
**Date**: 2026-04-14  
**Auditor**: Scout (Lens C)

---

## Summary

**3 categories of dead weight found**, totaling ~40 removable lines plus one micro-redundancy.  
No dead imports. No stale TODOs/FIXMEs. All static imports are used. The file is relatively clean.

---

## 1. Dead Model Definitions (HIGH — 30 lines)

**What**: Three model configs in the `models` record are defined but never referenced by any agent:
- `gpt54` (lines 168–174) — 0 agent.json files use this key
- `gemini3pro` (lines 175–181) — 0 agent.json files use this key
- `gemini3flash` (lines 182–188) — 0 agent.json files use this key

**Evidence**:
```
$ grep -r "gpt54\|gemini3pro\|gemini3flash" agents/*/agent.json
(no results)

$ grep -roh '"model": *"[^"]*"' agents/*/agent.json | sort | uniq -c | sort -rn
  7 "model": "opus"
  2 "model": "gpt52"
  1 "model": "kimi"
```

Models are consumed by `agent-loader.ts` line 355: `opts.models[config.model]`. Only `opus`, `gpt52`, and `kimi` are ever looked up. The other three are dead entries in the record.

**Lines**: 168–188 (3 × ~7 lines each = ~21 lines of definitions)  
**Impact**: ~21 lines removable. Also removes dead env var reads for `KIMI_BASE_URL`... wait, kimi IS used. Only `gpt54`, `gemini3pro`, `gemini3flash` are dead.

**Risk**: Low. These are purely additive config — removing them doesn't change behavior. If someone adds an agent with `"model": "gpt54"` in the future, they'd get a startup error (model not found), which is the correct behavior — better to define when needed.

---

## 2. Redundant `readSessionMeta` Re-import via require() (LOW — micro)

**What**: `readSessionMeta` is statically imported at line 11 and is available throughout the module scope. At line 580, inside the context-learn subscriber's `setTimeout` callback, it is re-imported via `require("../lib/index.js")` as `readMeta`.

```typescript
// Line 11 (static import — used at line 460)
import { readSessionMeta } from "../lib/index.js";

// Line 580 (redundant re-import)
const { readSessionMessages, readSessionMeta: readMeta } = 
  require("../lib/index.js") as typeof import("../lib/index.js");
```

The `require()` is needed for `readSessionMessages` (not statically imported), but the `readSessionMeta: readMeta` destructure is redundant — the static import `readSessionMeta` is already in scope.

**Lines**: 580 (partial — remove `, readSessionMeta: readMeta` from destructure, replace `readMeta` with `readSessionMeta` at line 590)  
**Impact**: ~0 lines saved, but removes a confusing alias that looks intentional but isn't.

**Risk**: None. Pure simplification.

---

## 3. Stale Backward-Compat Comment Block (LOW — 4 lines)

**What**: A comment block explaining that `onCommand` was removed and all commands now flow through `bus.subscribe()`. This documents a past refactor, not current behavior.

```typescript
// ── Backward compat: onCommand removed ──────────────────────────────────
// All commands now flow through bus.subscribe() above.
// Socket normalizes aliases (run→fork, close→shutdown, reload_agents→reload)
// and emits directly to the bus.
```

**Lines**: 870–873  
**Impact**: 4 lines removable. No code, just stale archaeological commentary.

**Risk**: None.

---

## Not Dead (Verified Live)

These looked suspicious but are actually used:

| Item | Why it's live |
|------|---------------|
| `execSync` import | Used in `--version` block (line 40), which runs before anything else |
| `createInterface` import | Used in interactive readline loop (line 1194) |
| `appendFileSync` import | Used in `escalateToHuman()` (line 312) |
| `unlinkSync` import | Used in PID cleanup (line 894) |
| `InstanceIdentity` interface | Used as type for `writeIdentity()` param (line 76) |
| `ENV_SESSION_ID/PARENT_*` vars | Used in task mode (lines 1039–1041) |
| `contextLearnAgents` Set | Used in subscriber filter (line 574) |
| `PROCESS_START_TIME` | Used in exit handler (line 713) |
| `cancelledOnce` flag | Used in SIGINT handler (line 1200) |
| `recoveryAttempts` Map | Used in session recovery subscriber (line 399) |
| All `node:fs` imports | Each used at least once |

---

## Total Removable

| Category | Lines | Bytes (est.) |
|----------|-------|-------------|
| Dead model defs (gpt54, gemini3pro, gemini3flash) | ~21 | ~650 |
| Stale backward-compat comment | 4 | ~250 |
| Redundant readMeta alias | ~0 (refactor) | ~30 |
| **Total** | **~25** | **~930** |

**Verdict**: may.ts is fairly clean. The dead model definitions are the only substantive dead weight. The file has no dead imports, no dead functions, no unreachable code paths, and no stale TODOs. Previous cleanups (evaluator -49%, tools -714 lines) didn't leave orphaned consumers here.
