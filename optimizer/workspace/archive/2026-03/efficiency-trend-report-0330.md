# Efficiency Trend Report — 2026-03-30

Generated: 2026-03-30T02:40 UTC

## 3-Day System Health Comparison

| Metric | 72-48h ago (Mar 27-28) | 48-24h ago (Mar 28-29) | Last 24h (Mar 29-30) |
|--------|------------------------|------------------------|----------------------|
| Sessions | 177 | 142 | 184 |
| Total Ops | 2,261 | 1,515 | 1,909 |
| Avg Ops/Session | 12.8 | 10.7 | 10.4 |
| Max Ops | 51 | 57 | 55 |
| Errors | 13 | 4 | 20 |
| Wasted Ops | 0 | 50 | 25 |
| Waste Rate | 0.0% | 3.3% | 1.3% |
| Productive Ops/Hr | 94.2 | 61.0 | 78.5 |

## Analysis

### Positive Trends
1. **Waste rate improving**: 3.3% → 1.3% (last two days). The 1.3% waste in the last 24h is near the theoretical minimum for a system with external dependencies.
2. **Average ops/session declining**: 12.8 → 10.7 → 10.4 — agents are getting more efficient per session.
3. **Error impact decreasing**: The 20 errors in the last 24h produced only 25 wasted ops (vs 50 wasted from just 4 errors the day before), because 15 were connection errors (0 ops each) and 4 were tech-lead jsonSchema (0 ops each).

### Notable Events
- **Mar 28-29**: Lowest activity (142 sessions, 61 ops/hr) — Bob recovery in progress, system stabilizing after restart.
- **Mar 29 13:06-13:21**: Connectivity outage — 13 connection errors across all agents (0 ops each, minimal impact).
- **Mar 29 15:07**: Process restarted on binary f83555f (HEAD). Tool quality handler resumed generating data.
- **Mar 29 09:06**: Only real waste — Bob error with 25 ops (LLM tool-use content block issue).

### Recurring Issues (Low Priority)
- **Tech-lead jsonSchema error**: 4 occurrences in 48h, all 0 ops, at :39 each hour during heartbeats. Likely a dependency issue with Anthropic SDK tool definition parsing. Cost: ~$0 per occurrence.
- **Connection errors**: 13 in one 15-minute burst. Likely upstream provider issue. System self-healed.

### Key Efficiency Metrics
- **Tool waste rate**: 2.65% (stable for 4 readings, down from 4.7% a week ago)
- **Productive efficiency**: 98.7% of ops are productive (only 1.3% wasted)
- **Agent budget compliance**: All optimizer heartbeats under 35-op budget (avg 16.7 ops)
- **JS handler coverage**: QA, May, Evaluator, Scout all using JS handlers for routine work (1-3 ops)

## Recommendations
1. **No urgent action needed** — system is running at near-optimal efficiency.
2. **Gym baseline on f83555f** still pending — needs dedicated cron:optimize session.
3. **Tech-lead jsonSchema bug** could be investigated if it starts consuming ops.
4. **Coder waste** (bash:other, nonexistent-path) is #1 tool quality issue but zero coder sessions recently to verify interventions.
