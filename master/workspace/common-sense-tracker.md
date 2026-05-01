# Common Sense Behavioral Verification Tracker

## Verified Items

### "Evidence first. Claims need tool output."
- **Date:** 2025-06-27 (re-verified 2025-07-01)
- **Verdict:** ✅ YES — Being followed
- **Evidence:** Searched 15+ recent sessions. All sessions completing with `"status":"success"` included `verification_evidence` arrays. Example from s_1777485773079_0: `"verification_evidence":["Step 1: read(agents/shared/may-agent-docs/design/agent-metrics.md) confirmed Hao's rewrite with 6 system metrics, balanced pairs for projects, metric lifecycle"]`. No counter-examples found (success without evidence).
- **Re-verification (2025-07-01):** Checked all successful sessions from past 24h. Every one includes populated arrays. Examples: `s_1777562832948_1`: "Step: read .state/human-inputs.jsonl confirmed 3 new entries after cutoff ts"; `s_1777540924388_36`: "Step: read EXP-270 at offset 35 confirmed status updates applied correctly". 0 sessions found with success but missing verification_evidence.

### "Context first. Before acting, gather enough context to act well."
- **Date:** 2025-07-01
- **Verdict:** ✅ YES — Being followed
- **Evidence:** Session `s_1777553411813_183` (coach heartbeat) shows first 7 tool calls are ALL context-gathering bash commands: listing workspace files, reading experiment docs, checking todo.md — before any action is taken. Also, C12.1 convention ("session-start: read context files in first 5 tool calls") is explicitly enforced system-wide with coaching tracking violations, confirming this is structurally embedded.

### "Simple first. Try the simplest approach. If it works, stop."
- **Date:** 2025-07-01
- **Verdict:** ✅ YES — Generally followed (with caveats)
- **Evidence:** Of 22 recent successful sessions sampled, 10 completed without any PIVOT (clean first-attempt execution). Example: `s_1777560727291_270` completed a reflection task in just 25 lines with no retries. Sessions that DO pivot (12/22) typically fail due to permission errors or path issues (infrastructure), not overengineering. Summary quote: "Completed reflection procedure. Analyzed 3 new human inputs since last reflection."
- **Caveat:** 55% of successful sessions required at least one PIVOT, but these appear to be environmental (EACCES, wrong path) rather than agents choosing complex approaches over simple ones.

### "Follow the breadcrumbs. Each piece of context leads to more."
- **Date:** 2025-07-02
- **Verdict:** ✅ YES — Being followed
- **Evidence:** In session `s_1777485773079_0`, agent reads guard-breakdown-strict.json → finds EXP-251 coaching results → reads 3 project files (skill-workflow, hao-alignment, eval-revival) → synthesizes gaps → dispatches targeted work. Quote showing breadcrumb-following: `"This is very revealing. Now let me look deeper at the confounds - agents with more skills tend to have harder tasks"` (coach session s_1777511182329_1, peeked from orchestrator). Also in same session: agent reads agent-metrics.md design doc after user points to it, then provides detailed review identifying which metrics won't work due to DB state discovered in earlier investigation.

## Unverified Items
- Ask questions when unsure
- Convention over configuration
- Metric-oriented
- Never stop at target met
