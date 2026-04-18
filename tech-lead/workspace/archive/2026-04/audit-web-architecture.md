# Web Architecture Audit — Lens A

**Date**: 2026-04-12  
**Files reviewed**: `src/app/ui/web.ts` (732 lines), `src/app/ui/web-static/index.html` (1834 lines)  
**Triggered by**: 5 phases of Web UI additions — is web.ts becoming a god-file?

---

## 1. Size & Structure Overview

### web.ts — 732 lines
| Component | Lines | % |
|-----------|-------|---|
| Imports / types / API surface | 35 | 5% |
| `_db()` + `findSocketPath()` | 30 | 4% |
| Route handlers (13 functions) | 530 | 72% |
| `json()` + `serveIndex()` | 24 | 3% |
| WebSocket proxy | 117 | 16% |
| Standalone mode | ~30 | 4% |

### index.html — 1834 lines (single-file SPA)
| Component | Lines | % |
|-----------|-------|---|
| CSS | 253 | 14% |
| HTML structure | 94 | 5% |
| JavaScript | 1487 | 81% |

### Route Count: 16 routes
| Route | Handler | Lines | Error handling |
|-------|---------|-------|----------------|
| `/api/requests` | handleRequests | 35 | ❌ None |
| `/api/sessions/:id` | handleSession | 20 | ❌ None |
| `/api/sessions/:id/transcript` | handleTranscript | 43 | ✅ try-catch (per-line) |
| `/api/digest` | handleDigest | 15 | ❌ None |
| `/api/benchmarks` | handleBenchmarks | 85 | ✅ try-catch → json error |
| `/api/benchmarks/prompts` | handleBenchmarkPrompts | 33 | ✅ try-catch → json error |
| `/api/benchmarks/compare` | handleBenchmarkCompare | 43 | ✅ try-catch → json error |
| `/api/stats` | handleStats | 28 | ❌ None |
| `/api/agents/activity` | handleAgentActivity | 42 | ❌ None |
| `/api/agents/timeline` | handleAgentTimeline | 34 | ❌ None |
| `/api/agents/health` | handleSystemHealth | 45 | ❌ None |
| `/api/agents/:name/detail` | handleAgentDetail | 67 | ❌ None |
| `/api/browse` | handleBrowse | 35 | ✅ try-catch (per-entry) |
| `/api/digest` | handleDigest | 15 | ❌ None |
| `/ws` | proxyWebSocket | 117 | ✅ (unix socket) |
| `/` | serveIndex | 13 | ❌ None |

**8 of 13 API handlers have NO error handling.** A bad query or missing table will crash with an unhandled exception and return a 500 with a raw stack trace.

---

## 2. Is web.ts a God File?

**Verdict: Not yet, but trending that direction.**

At 732 lines with 13 handler functions, it's still manageable. The key metric isn't total lines but *cognitive load per handler* — most handlers are 20–45 lines of straightforward DB query → JSON response. The outliers:

- **handleBenchmarks**: 85 lines — this is the most complex handler with 3 sub-modes (batch detail, batch listing, per-agent summary). This alone could justify extraction.
- **handleAgentDetail**: 67 lines — queries 4 different data sets (sessions, evals, delegation, workspace files).
- **proxyWebSocket**: 117 lines — fundamentally different concern from REST handlers.

The file follows a clear pattern: each handler is a standalone function with no shared state beyond `_db()`. This makes future extraction trivial.

---

## 3. Patterns & Repetition

### What's well-done
- All SQL queries use parameterized `?` placeholders — no SQL injection risk
- The `json()` helper centralizes response formatting and CORS headers
- Each handler is a pure function: `(url/params) → Response`
- Clean separation: REST handlers don't leak WebSocket concerns

### Repetition found
1. **Time math duplication**: `now - 86400000`, `now - 7 * 86400000`, `now - 2 * 60 * 60 * 1000` appears in 5 handlers (handleStats, handleAgentActivity, handleAgentTimeline, handleSystemHealth, handleAgentDetail). Could be `const DAY = 86400000`.

2. **DB access pattern**: Every handler does `_db().prepare(...).all(...)` or `.get(...)`. The `_db()` call is repeated 32 times. This is fine — it's a lazy getter, not a connection open — but a pattern like `query(sql, ...params)` could reduce boilerplate.

3. **Type casting**: `as any` appears frequently for DB results. No runtime validation of query results.

4. **Date range filtering**: Multiple handlers compute "since X hours ago" then filter sessions. This is a cross-cutting concern.

### Repetition NOT found
- No duplicated SQL queries (each serves different data needs)
- No duplicated response formatting (all go through `json()`)
- No copy-paste handlers

---

## 4. Architecture Scalability

### Current routing approach
```typescript
if (url.pathname === "/api/requests") return handleRequests(url);
if (url.pathname === "/api/stats") return handleStats();
// ...13 more if-statements
const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/detail$/);
```

This is a **linear scan** of 16 routes per request. At 16 routes this is fine (~1μs). At 100 routes it would still be fine. The issue isn't performance but maintainability — adding a route requires editing both the handler function AND the routing block.

### Natural domain groupings for future extraction
If web.ts crosses ~1000 lines, these groups could become separate files:

| Group | Handlers | Lines | File candidate |
|-------|----------|-------|----------------|
| **Agents** | activity, timeline, health, detail | 188 | `routes/agents.ts` |
| **Benchmarks** | benchmarks, prompts, compare | 161 | `routes/benchmarks.ts` |
| **Sessions** | session, transcript | 63 | `routes/sessions.ts` |
| **Knowledge** | browse, digest | 50 | `routes/knowledge.ts` |
| **Core** | requests, stats | 63 | Stay in web.ts |
| **WebSocket** | proxyWebSocket | 117 | `ws-proxy.ts` |

### When to split
**Not now.** At 732 lines with clean function boundaries, splitting would create overhead (import/export boilerplate, module boundaries) without reducing complexity. The rule of thumb: split when a single handler exceeds 150 lines, or the file exceeds 1200 lines, or when two developers need to edit different route groups simultaneously.

---

## 5. Security Assessment

### ✅ Good
- **SQL injection**: All queries use parameterized placeholders, even the dynamic `WHERE` clause in handleRequests (builds `where` string with `?` markers, passes values as params array)
- **Path traversal in handleBrowse**: Uses `join()` which normalizes `..` segments, then checks `startsWith(sharedDir)`
- **File type filtering**: handleBrowse only serves `.md`, `.ts`, `.json` files

### ⚠️ Minor issues

1. **Path prefix collision** in handleBrowse (line 562):
   ```typescript
   if (!absPath.startsWith(sharedDir)) return json({ error: "Access denied" }, 403);
   ```
   A path like `?path=../../agents/shared-evil/secret` would resolve to `/app/agents/shared-evil/secret` which starts with `/app/agents/shared`. Fix: `startsWith(sharedDir + "/")` or use `resolve()` + trailing slash check.

2. **No auth/rate limiting**: All API endpoints are open to anyone who can reach the port. This is acceptable for a local dev tool but would be a concern if exposed to the internet. The server binds to `0.0.0.0`.

3. **CORS `*`**: The `Access-Control-Allow-Origin: *` header allows any origin to call the API. Fine for local dev, problematic if internet-exposed.

4. **Markdown XSS surface**: `index.html` uses `marked.parse()` to render markdown from the server directly into `innerHTML` (6 call sites). If an attacker can inject content into agent digest files or agent responses, this creates an XSS vector. Low risk since content comes from our own agents, not user input. Could be mitigated with DOMPurify.

5. **Inconsistent error handling**: 8/13 handlers have no try-catch. An uncaught exception in a handler will return a raw error. Bun's server catches this and returns 500, but the error message may leak internal paths.

### ❌ Not a concern
- No cookies, no sessions, no auth tokens to steal
- readFileSync is synchronous but acceptable since Bun's server runs each request independently

---

## 6. Frontend Architecture (index.html)

At 1834 lines in a single HTML file, the frontend is more concerning than the backend. The 1487 lines of JavaScript include:

- Dashboard rendering (health, agent grid, timeline, feed)
- Session inspector with deep-dive tabs
- Chat with WebSocket management
- Benchmark viewer with comparison and prompt diff
- Knowledge browser with markdown rendering

### Issues
1. **No module system**: Everything is in global scope. Functions like `loadBenchmarks()`, `loadAgentGrid()`, `switchSession()` are all global.
2. **No state management**: State scattered across global variables (`selectedAgent`, `currentSessionId`, `compareA`, `compareB`, `feedPaused`, etc.)
3. **HTML templated in strings**: All rendering uses string concatenation with `innerHTML`. No templating library, no virtual DOM.
4. **Single-file scaling limit**: At 1834 lines, this file is already harder to navigate than web.ts.

### However...
This is a **dev dashboard**, not a production web app. The constraints are different:
- No build step needed (works as static HTML)
- Easy to deploy (one file)
- Easy to read (all context in one place)
- Acceptable for internal tooling

### When to refactor the frontend
If adding more tabs or features, consider:
- Extract JS into `dashboard.js` (loaded via `<script src>`)
- Use a lightweight framework like Preact (would add a build step)
- At minimum, extract CSS into `styles.css`

---

## 7. Recommendations

### Now (quick wins)
1. **Add try-catch to all handlers**: Wrap each handler body in try-catch returning `json({ error: String(err) }, 500)`. 8 handlers need this. ~30 minutes of work.
2. **Fix path prefix collision**: Change `startsWith(sharedDir)` to `startsWith(sharedDir + "/")` in handleBrowse. 1-line fix.
3. **Extract time constants**: `const DAY_MS = 86400000; const HOUR_MS = 3600000;` at top of closure. Trivial.

### Later (if growth continues)
4. **Extract WebSocket proxy**: `proxyWebSocket` (117 lines) is a self-contained concern. Moving it to `ws-proxy.ts` would be the highest-value first extraction.
5. **Extract benchmark routes**: The 3 benchmark handlers (161 lines) form a cohesive group with no dependencies on other handlers.
6. **Generic error middleware**: Wrap all handlers in a `safeHandler()` that catches errors, logs them, and returns clean JSON errors.

### Not recommended
- **Don't add a routing framework** (Express, Hono, etc.) — the 16-route if/else chain is simpler and has zero dependencies.
- **Don't split web.ts now** — the function-per-handler pattern makes the file easy to navigate even at 732 lines.
- **Don't rewrite the frontend** — it works, it's maintainable enough for internal tooling.

---

## Summary

**web.ts is healthy.** 732 lines, 13 handlers, clean function boundaries, good SQL hygiene. The main risks are inconsistent error handling (8 unprotected handlers) and a minor path traversal edge case in handleBrowse. The file can absorb 2–3 more feature phases before splitting becomes justified.

**index.html is the bigger concern** at 1834 lines of single-file SPA, but acceptable for dev tooling. The next extraction trigger should be when it crosses ~2500 lines or when multiple people need to edit it simultaneously.
