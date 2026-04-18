# Deliverables Checklist — Own Your Metrics (2026-04-18)

- [ ] agents/optimizer/scripts/refine-metrics-2026-04-18.ts — idempotent DB update script
- [ ] agents/optimizer/workspace/metrics-definitions.md — fate table for 3 metrics
- [ ] Run the script to apply updates
- [ ] Manually trigger one measurement per Option-B metric so current ≠ null
- [ ] Verify DB reflects updated target/threshold/source_query/current
- [ ] Commit in agents/ (script + definitions) — also in /app root if script lives there
- [ ] finish() with commit SHA + (metric, fate) list
