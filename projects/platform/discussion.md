# platform — Discussion

Comment inbox for the platform project. The project handler watches this file
for unread content and resumes the project when new comments appear.

Append format (use `### <author> - YYYY-MM-DD` per entry — this is what
`appendProjectComment` and `appendDiscussionComment` write):

```
### alice - 2026-05-15
Body of the comment goes here.
Multiple lines are fine.
```

The project workflow appends a `---read @iter<N>---` sentinel line after each
iteration; anything **below the last** such line is considered unread.

---read @iter0---

### hao - 2026-05-15
smoke test: comment from curl after fix

---read @iter3---

### hao - 2026-05-15
verify after UI path fix

---read @iter5---

### hao - 2026-05-15
after projectIdOf/projectPathOf refactor

---read @iter8---

### hao - 2026-05-15
verify synchronous status flip

---read @iter10---

### hao - 2026-05-15
browser test: e2e-headless-2026-05-15T14:10:27.919Z

---read @iter12---

### hao - 2026-05-15
browser test: e2e-headless-2026-05-15T14:10:49.170Z

### hao - 2026-05-15
one chore: you are inside the some container as may-agent instance, so you have full access of sock/api. please review the docs, explore and try the features prvoided, check whether the features is useful, whether the doc is accurate, whether the imp is solid. Feedback with your suggestion: which is broken, which is good, which we should improve.

---read @iter14---

### hao - 2026-05-15
New feature requirements for the platform web UI:

1. **Session → API call mapping**: Deep dive into how session history entries map to the actual API calls sent out. Surface this relationship in the UI.

2. **Session tab: logs + API calls**: The session tab should display both the original session logs AND the API call related to each log entry (side-by-side or linked).

3. **LLM-powered session summarization**: Allow summarizing session logs using an LLM for quick investigation — so users don't have to read through hundreds of lines.

4. **Session scoring**: Score sessions on dimensions like: efficient? wasteful? keep-cycling? Brainstorm other useful scoring dimensions.

5. **Top-down & bottom-up investigation**: Think holistically about what helps users investigate agent work from both directions — high-level overview drilling down, and individual session details rolling up to patterns.

These should help users understand what their agents are actually doing, how much it costs, and where the waste is.

---read @iter20---

### hao - 2026-05-16
Please prioritize implementation item 2 from outputs/iter20-ui-feature-design.md: add a Logs + API view in the session inspector. Start with the focused UI/basic version using existing transcript data: group assistant API responses with their tool calls and tool results, show original session logs and related API call info together, and use existing per-assistant api/model/usage fields from session.jsonl where available. Keep it focused; do not start LLM summarization or full session scoring yet.

---read @iter24---

### hao - 2026-05-16
browser test: e2e-headless-2026-05-16T14:35:30.713Z

---read @iter29---

### hao - 2026-05-16
browser test: e2e-headless-2026-05-16T14:40:17.332Z

---read @iter31---

### hao - 2026-05-16
browser test: e2e-headless-2026-05-16T15:26:40.754Z

---read @iter32---

### hao - 2026-05-20
Recently we reframed the scope of the platform project. Redesign the web UI to reflect the scope change: the web UI should foreground infrastructure fundamentals so a user can understand the system and what it is on. We are just watching from here; route this through the project.

### codex - 2026-05-20
Design advice for the scope reframing:

The Web UI should stop reading like an agent productivity dashboard first. The first screen should answer: what is this system, what substrate is running, what are its core loops, and what evidence says those loops are alive.

Suggested information architecture:

1. Rename the first tab from `Live` to `Overview` or `System`.
2. Put an infrastructure map at the top: runtime, event bus, session runner, project handler, metrics/alerts, persistence, Web UI, SDK/API, agents. Each block should show current state and link to the evidence surface that supports it.
3. Treat agents and projects as consumers of the substrate, not the headline. They should remain visible, but below the infrastructure fundamentals.
4. Add a "How the system works" lane: trigger -> handler/workflow -> session/tool calls -> events -> metrics/evaluation -> project state. This should be inspectable with real recent examples, not explanatory marketing text.
5. Reframe metrics into operational contracts: liveness, trace completeness, handler success, evaluation coverage, project readiness, event persistence. Each card should explain owner, current value, threshold, last evidence, and what wakes when it breaches.
6. Make project state legible as a control loop: active means push; waiting means watch; blocked means dependency; pending-review means judgment. The UI should show why each waiting project is validly waiting.
7. Keep session inspection, Logs + API, and traces as drill-down tools from the overview, not separate mystery tabs users must discover.
8. Add an "What is this on?" panel: repo path, container/runtime identity, data roots, DB location, Web UI build source, docs/source links, and last deploy/build/test evidence.

Design principle: the page should make the platform observable before it makes agents conversational.

---read @iter38---

### project-creative-audit - 2026-05-20
**Project creative audit suggestion**

This is a proposal-only fallback review. The project owner should review it before changing project state or tasks.

- Project: projects/platform
- Trigger: project.health.finding
- Selection reason: targeted by event; project is active; no parser-visible tasks; recently changed
- Audit session: s_1779267210082_82

Audited projects/platform. Project is coherent and well-maintained with one process issue and one strategic observation.

---read @iter38b---

### project-creative-audit - 2026-05-20
**Project creative audit suggestion**

This is a proposal-only fallback review. The project owner should review it before changing project state or tasks.

- Project: projects/platform
- Trigger: timer.tick
- Selection reason: project is waiting; all parser-visible tasks are done; recently changed
- Audit session: s_1779293335598_6

Audited projects/platform. Project is coherent and well-managed — in appropriate WAITING state with all tasks complete.
