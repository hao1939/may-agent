# Cost Scan — 2026-03-19T23:20Z

## Metrics (last 4h, ~19:20-23:20 UTC)
- **38 sessions**, 6,020KB total (159KB avg)
- **Error rate: 2.6%** (1/38) — tech-lead LLM truncation (transient)
- **No real agent errors**

## Agent Breakdown
| Agent | Sessions | KB | Avg KB | Notes |
|-------|----------|----|--------|-------|
| coach | 8 | 1,262 | 158 | **54% reduction from 345KB avg** — turn budget working |
| optimizer | 6 | 1,254 | 209 | Includes 544KB skill-lifecycle workflow |
| tech-lead | 5 | 1,132 | 226 | Still high — heartbeats 217-296KB |
| bob | 4 | 667 | 167 | Normal |
| qa | 5 | 546 | 109 | Normal |
| amy-kimi | 3 | 310 | 103 | Normal |
| may | 5 | 256 | 51 | Lean — handler sessions |
| coder | 2 | 128 | 64 | Lean — gym runs |

## Key Findings

### 1. Coach cost dramatically reduced
Turn budget (15 tool calls/heartbeat) cut avg session size from 345KB to 158KB (54% reduction).
Heartbeats now 100-109KB. Growth-cycle sessions still heavy (375KB) but expected.

### 2. Tech-lead now #2 cost driver at 226KB avg
Three heartbeat sessions at 217-296KB. Possible targets for optimization.

### 3. Binary still 13 commits behind HEAD
All deployed guards (read-dedup, finish-evidence, session-read-guard) remain inactive.
Estimated blocked savings: $30-43/day.
No bun available to rebuild. Multiple escalations filed.

## Actions
- ✅ Rebuilt gym-score-utils.cjs (c6e4ab0) — fixes verification detection for gym tests
- No new waste patterns found — system is running efficiently within binary constraints
