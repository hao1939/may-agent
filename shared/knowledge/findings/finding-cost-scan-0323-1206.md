# Cost Scan — 2026-03-23T12:06

## Window
- 40 sessions over ~3 hours (09:09–12:06 UTC)
- 661 total ops, 6.6 MB session data

## Cost Summary
| Agent     | Sessions | LLM Calls | Cost/3h | Cost/24h | % Total | Input(K) | CacheRd(K) |
|-----------|----------|-----------|---------|----------|---------|----------|-------------|
| optimizer | 9        | 251       | $22.98  | $183.85  | 34.4%   | 7,303    | 0           |
| coach     | 14       | 250       | $18.37  | $146.97  | 27.5%   | 5,829    | 0           |
| tech-lead | 3        | 124       | $10.79  | $86.29   | 16.2%   | 3,464    | 0           |
| bob       | 4        | 96        | $8.08   | $64.61   | 12.1%   | 1,281    | 3,582       |
| scout     | 1        | 33        | $3.26   | $26.08   | 4.9%    | 1,011    | 0           |
| may       | 4        | 43        | $2.12   | $16.97   | 3.2%    | 660      | 0           |
| qa        | 2        | 21        | $0.67   | $5.36    | 1.0%    | 142      | 310         |
| coder     | 2        | 16        | $0.30   | $2.39    | 0.4%    | 91       | 0           |
| evaluator | 1        | 7         | $0.17   | $1.34    | 0.3%    | 38       | 40          |
| **TOTAL** | **40**   | **841**   | **$66.74** | **$533.92** | **100%** | **19,818** | **3,932** |

## Key Findings

### 1. PROMPT CACHING STILL 0% FOR CLAUDE ($200+/day savings potential)
- Bob (Gemini): 70-85% cache hit rate ✓
- All Claude agents: 0% cache read tokens
- ANTHROPIC_API_KEY env var still not set
- Claude input: ~18.5M tokens/3h = 148M/24h
- At 75% cacheable, savings: ~$133/3h → ~$267/day (90% discount on cached reads)
- **Status: BLOCKED on Hao setting ANTHROPIC_API_KEY**

### 2. OPTIMIZER = #1 COST ($22.98/3h, 34.4%)
- 9 sessions, 251 LLM calls (28 calls/session avg)
- Biggest sessions: heartbeats ($4.69/ea, 48 calls) and cron:optimize ($4.69, $4.50)
- Context growth: first call 5-7K tokens → last call 35-45K tokens
- Second half of each session costs 50-80% more than first half
- Skill-lifecycle Phase 1 DISCOVER: $3.52 (34 calls, reads lots of session data)

### 3. COACH = #2 COST ($18.37/3h, 27.5%)  
- 14 sessions (most of any agent), 250 total LLM calls
- Sprint execution session: $5.42 (60 LLM calls, 47 bash calls)
- 19 pure bash-as-cat calls (should be read()) in coach sessions
- Sprint planning session: $3.27 (37 calls)

### 4. TECH-LEAD HIGH COST PER SESSION ($3.60 avg)
- Only 3 sessions but 124 total LLM calls (41 calls/session avg)
- This is efficient per-session but high per-call

### 5. BASH-AS-CAT STILL 12.4%
- 86 bash-as-cat calls out of 691 bash calls
- Breakdown: 23 pure reads (waste), 10 appends (write ops), 32 pipes (mixed), 21 other
- Coach: 52 cat calls (19 pure reads)
- Optimizer: 20 cat calls (3 pure reads)

## Actionable Items

### Can Do Now
1. **Self-budget**: Ensure optimizer heartbeats stay under 30 ops (currently hitting 48)
2. **Coach budget enforcement**: Send nudge to coach about 30-op heartbeat cap
3. **Bash-as-cat coaching**: 19 pure cat-reads in coach sessions → could save ~5 calls/session

### Requires Hao/Infra
1. **Set ANTHROPIC_API_KEY** — Single biggest savings: ~$267/day
2. **Binary rebuild** — 5 handlers still dead since last rebuild

### Already In Progress
- skipIfIdle working (38 skips last period)
- Session-read-guard deployed (blocks session.jsonl reads)
- Cron intervals at 30 min
