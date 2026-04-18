# Web Frontend Complexity Audit

**File:** `src/app/ui/web-static/index.html` (1834 lines)
**Backend:** `src/app/ui/web.ts` (732 lines)
**Date:** 2026-04-12

## Summary

The web UI is a single monolithic HTML file containing all CSS, HTML structure, and JavaScript. It implements 4 distinct views (Dashboard, Chat, Knowledge, Benchmarks) with no bundler, no component system, and no external JS dependencies beyond `marked.js`. The architecture is functional but accumulating complexity — the file is now 1834 lines, with the JavaScript alone at 1485 lines containing 46 functions.

---

## 1. Architecture Overview

### Section Breakdown

| Section | Lines | Range | % of file |
|---------|-------|-------|-----------|
| CSS (`<style>`) | 252 | 7–259 | 13.7% |
| External scripts | 1 | 260 | — |
| HTML body | 88 | 261–347 | 4.8% |
| JavaScript (`<script>`) | 1485 | 347–1832 | 81.0% |
| **Total** | **1834** | | **100%** |

**Key observation:** 81% of the file is JavaScript. The HTML body is a minimal shell — almost all UI is generated dynamically via `innerHTML` assignments (51 total).

### External Dependencies
- `marked@15.0.12` (CDN) — markdown rendering

---

## 2. Views / Routing

### 4 tabs, hash-based routing

| Tab | Element ID | Key Functions | Line Count (approx) |
|-----|-----------|---------------|---------------------|
| **Dashboard** | `#dashboard` | loadHealth, loadAgentGrid, loadAgentDeepDive, loadTimeline, loadStats, loadRequests, loadSessionDetail, renderTree, loadDigest | ~900 lines |
| **Chat** | `#chat` | initChat, connectWs, sendChat, switchSession, renderSessionPicker | ~260 lines |
| **Benchmarks** | `#benchmarks` | loadBenchmarks, toggleCompare, showComparison, showPrompt, showPromptDiff | ~240 lines |
| **Knowledge** | `#knowledge` | loadKnowledge, browsePath, viewFile, renderFileContent | ~90 lines |

**Routing mechanism:** `location.hash` stores the current tab. On click, all 4 divs are toggled via `classList.toggle('hidden', ...)`. No URL-based deep linking for individual sessions/pages.

**Dashboard is the complexity center** — it alone accounts for ~60% of the JavaScript, handling:
- System health summary cards
- Agent status grid with click-to-drill-down
- Agent deep dive panel (4 sub-tabs: Sessions, Evaluations, Delegation, Workspace)
- Activity timeline (gantt-style visualization)
- Activity feed (live)
- Request list with filters + pagination
- Session detail inspector (with recursive child tree, transcript, evaluation scores)
- Daily digest panel

---

## 3. JavaScript Code Structure

### Organization: Flat function list (no modules, no classes)

All 46 functions are defined at the global scope. No namespacing, no modules, no class-based organization.

### Largest Functions (complexity hotspots)

| Function | Lines | Purpose |
|----------|-------|---------|
| `loadSessionDetail` | 166 | Session inspector — builds complex HTML with metadata, eval scores, transcript |
| `connectWs` | 145 | WebSocket connection, message routing, UI updates for all event types |
| `loadBenchmarks` | 140 | Benchmark table with batch comparison, expandable details |
| `loadAgentDeepDive` | 119 | Agent drill-down with 4 sub-tabs of content |
| `loadDigest` | 71 | Daily digest rendering with custom markdown parser |
| `loadTimeline` | 59 | Gantt chart visualization |
| `browsePath` | 52 | Knowledge base directory browser |

### Function Categories

| Category | Count | Functions |
|----------|-------|-----------|
| Data fetching | 14 | loadHealth, loadAgentGrid, loadAgentDeepDive, loadTimeline, loadStats, loadRequests, loadSessionDetail, loadBenchmarks, showComparison, showPrompt, showPromptDiff, loadDigest, browsePath, viewFile |
| UI rendering | 10 | renderRequests, renderTree, renderAssistantMsg, renderSessionPicker, renderFileContent, scoreBar, addFeedItem, updateCompareBar, switchDeepDiveTab, toggleMarkdown |
| Navigation | 6 | toggleAgentFilter, hideAgentDeepDive, goBackSession, navigateToSession, switchSession, switchToChat |
| Utility | 5 | fmtTime, statusColor, verdictColor, esc, positionTooltip |
| WebSocket | 2 | connectWs, sendChat |
| Chat helpers | 4 | initChat, askAboutRequest, askAboutSession, toggleFeedPause |
| State toggle | 3 | toggleOutcome, toggleCompare, toggleMarkdown |
| Tooltip | 2 | showTimelineTooltip, hideTimelineTooltip |

### Global State Variables (17 total)

```
currentTab, offset, limit, selectedAgent, timelineTooltip,
sessionHistory[], currentInspectedSession, ws, chatInitialized,
activeSessions[], currentSessionId, renderMd, feedPaused,
feedItems[], benchmarkAgent, compareA, compareB, kbCurrentPath
```

---

## 4. CSS Organization

**252 lines** in a single `<style>` block. Uses CSS custom properties (design tokens) defined in `:root`.

### Design Token System
```css
:root {
  --bg, --bg2, --bg3, --border, --fg, --fg2,
  --accent, --green, --red, --yellow, --purple,
  --font, --mono
}
```

### CSS Class Categories

| Category | Approx Selectors | Purpose |
|----------|-----------------|---------|
| Layout | ~8 | .header, .tabs, .tab, .main |
| Stats/Cards | ~12 | .stat, .health-card, .agent-card |
| Request list | ~8 | .request, .badge (7 status variants) |
| Session detail | ~15 | .panel, .tree-node, .session-inspector |
| Transcript/Chat | ~15 | .msg (4 variants), .chat-* |
| Timeline | ~12 | .timeline-*, .feed-* (10 agent color classes) |
| Knowledge tables | ~8 | .md-rendered th/td/h2/h3 |
| Agent deep dive | ~15 | .agent-deep-dive, .session-table, .eval-grid, .sparkline |
| Responsive | ~10 | 2 @media queries (768px, 480px) |

### Inline Styles
**135 `style=` attributes** in the HTML/JS template strings. This is significant — much of the styling is inline rather than in CSS classes, making it hard to maintain consistent spacing/sizing.

---

## 5. Data Flow / API Integration

### API Endpoints (17 unique)

| Endpoint | Method | Used By | Purpose |
|----------|--------|---------|---------|
| `/api/agents/health` | GET | loadHealth | System health summary |
| `/api/agents/activity` | GET | loadAgentGrid | Agent status cards |
| `/api/agents/{name}/detail` | GET | loadAgentDeepDive | Agent drill-down data |
| `/api/agents/timeline` | GET | loadTimeline | Gantt chart data |
| `/api/stats` | GET | loadStats | 24h/7d statistics |
| `/api/requests` | GET | loadRequests | Request list with filters |
| `/api/sessions/{id}` | GET | loadSessionDetail | Session metadata + tree |
| `/api/sessions/{id}/transcript` | GET | loadSessionDetail, switchSession | Message transcript |
| `/api/digest` | GET | loadDigest | Daily digest markdown |
| `/api/benchmarks` | GET | loadBenchmarks | Benchmark results |
| `/api/benchmarks/compare` | GET | showComparison | Batch comparison |
| `/api/benchmarks/prompts` | GET | showPrompt, showPromptDiff | Prompt text/diff |
| `/api/browse` | GET | browsePath, viewFile | Knowledge file browser |
| `/ws` | WebSocket | connectWs | Real-time events + chat |

### Data Flow Pattern
All 14 fetch-based functions follow the same pattern:
```javascript
async function loadXxx() {
  try {
    const r = await fetch('/api/xxx');
    const data = await r.json();
    // Build HTML string via template literals
    // Set innerHTML on target element
  } catch(e) {
    // Show error in element or console.error
  }
}
```

No shared fetch wrapper — each function has its own try/catch and error display logic. No loading state management (some functions set "Loading..." text manually, others don't).

### WebSocket Protocol
- Single connection, multiplexed
- Message types: `text`, `tool_call`, `tool_result`, `session_start`, `session_end`, `sessions`, `notification`, `error`, `info`
- Session subscription model: client sends `{ type: 'subscribe', sessions: [id] }`
- Auto-reconnect on close (3s delay)
- Session status polling every 15s via `{ type: 'status' }`

---

## 6. Complexity Hotspots

### 6.1 Dashboard is overloaded
The Dashboard view contains 8 distinct sub-features that could each be a separate module:
1. System health cards
2. Agent status grid
3. Agent deep dive (with 4 sub-tabs)
4. Activity timeline (gantt)
5. Live activity feed
6. Request list with filters
7. Session detail inspector
8. Daily digest

### 6.2 Three markdown rendering approaches
1. **`marked.js`** — used for chat messages (`renderAssistantMsg`) and knowledge files (`renderFileContent`)
2. **Custom regex parser** — used for digest rendering (`loadDigest`, ~10 lines of `.replace()` chains)
3. **CSS `.md-rendered` styles** — different CSS rules for chat markdown vs knowledge markdown

The digest could use `marked.js` instead of its own parser.

### 6.3 HTML generation via string concatenation
All UI generation uses `html += ...` with template literals, then sets `innerHTML`. This is the primary pattern (51 innerHTML assignments). The 3 largest functions (loadSessionDetail, loadBenchmarks, loadAgentDeepDive) each build 30+ `html +=` lines. No templating system, no virtual DOM.

### 6.4 Inline style proliferation
135 inline `style=` attributes, primarily in JS template strings. Examples:
- `style="display:flex;align-items:center;gap:8px"` — repeated layout patterns
- `style="color:var(--fg2);font-size:12px"` — repeated text styling
- `style="margin-bottom:16px"` — ad-hoc spacing

---

## 7. Duplication & Dead Code

### 7.1 Duplicated Patterns

| Pattern | Occurrences | Description |
|---------|-------------|-------------|
| Status badge rendering | 7+ CSS classes + statusColor() + verdictColor() | Multiple overlapping status→color mappings |
| Error display | 19 try/catch blocks | Each with slightly different error rendering |
| "Loading..." states | ~5 manual innerHTML sets | No shared loading indicator |
| Time formatting | fmtTime() used 2× directly, plus inline date formatting in timeline | |
| Tab switching | Duplicated in init code and click handler | Lines 370-380 and 1729-1737 |

### 7.2 Potentially Dead Code

| Item | Evidence |
|------|----------|
| `statusColor()` function | Referenced only once (in its own definition). CSS `.badge.done/.error/.running` classes handle status coloring in most places |
| `scoreBar()` function | Used only in loadSessionDetail eval display — tiny utility, not dead, but very limited scope |
| Agent-specific feed color classes | 10 hardcoded `.feed-agent-*` CSS classes (bob, tech-lead, coder, optimizer, coach, qa, scout, may, evaluator, amy-kimi) — these are data-driven and should be dynamic |

---

## 8. Backend API Analysis (web.ts — 732 lines)

### Structure
- Single `startWebUI()` function containing all handlers
- 13 route handlers, each a standalone function
- WebSocket proxy to Unix socket (agent runtime)
- All DB queries use direct SQL with `getDb()`

### Notable Patterns
- **Recursive CTE** in `handleSession` for building session child trees
- **Security**: Browse API restricts to `agents/shared/` directory only
- **No authentication** — no auth middleware on any endpoint
- **No rate limiting** — direct DB queries on every request
- **Transcript truncation**: Tool results truncated to 2000 chars

---

## 9. Recommendations (Structural, Not Style)

### High-Impact, Low-Risk
1. **Extract CSS inline styles to classes** — The 135 inline styles make the codebase brittle. Extract common patterns (`display:flex; gap:8px`, `color:var(--fg2); font-size:12px`) into utility classes.
2. **Unify markdown rendering** — Replace the custom regex parser in `loadDigest` with `marked.js` (already loaded). Remove 10 lines of fragile regex code.
3. **Remove `statusColor()` if truly dead** — Verify no dynamic usage, then remove.

### Medium-Impact
4. **Add a shared `fetchJSON()` wrapper** — Consolidate the 14 identical fetch-try-catch patterns into one function with loading state management.
5. **Split Dashboard sub-features** — The Dashboard JavaScript could be split into logical sections (even within the same file) with clear comment boundaries and shared helpers.
6. **Extract tab init duplication** — The tab switching logic at lines 370-380 is duplicated at lines 1729-1737 for the initial hash-based tab setup.

### For Future Consideration (if file grows past ~2500 lines)
7. **Module split** — Extract into separate files per tab: `dashboard.js`, `chat.js`, `benchmarks.js`, `knowledge.js`, loaded as ES modules.
8. **Component pattern** — Replace innerHTML string building with a lightweight component system (even just functions that return DOM elements).

---

## 10. Metrics Summary

| Metric | Value |
|--------|-------|
| Total file size | 1834 lines |
| CSS | 252 lines (13.7%) |
| HTML structure | 88 lines (4.8%) |
| JavaScript | 1485 lines (81.0%) |
| JS functions | 46 |
| Global variables | 17 |
| API endpoints called | 14 (+ 3 benchmark sub-endpoints) |
| WebSocket message types | 9 |
| innerHTML assignments | 51 |
| Inline style attributes | 135 |
| Event handlers | 48 |
| try/catch blocks | 19 |
| External dependencies | 1 (marked.js) |
| Views/tabs | 4 (Dashboard, Chat, Benchmarks, Knowledge) |
| Dashboard sub-features | 8 |
