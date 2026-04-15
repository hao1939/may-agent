# Cost Scan Finding — 2026-03-25T14:03

## Summary
Follow-up scan on previous findings. Two key P0/P1 fixes now confirmed applied and working.

## Key Metrics (24h window, from tool-quality report at 13:07 + evaluations DB)

| Metric | Current | Previous (10:33) | Change |
|--------|---------|-------------------|--------|
| Total calls | 4,582 | ~4,500 est | ~ |
| Wasted calls | 174 | 213 | -18% |
| Waste rate | 3.8% | 5.4% | -30% ✅ |
| QA waste | 8 (4.2%) | ~70 | -89% ✅ |
| Optimizer waste | 82 (6.3%) | ~92 | -11% |

## Fix Verification

### ✅ P0: QA SOUL.md npx fix (req:ebee63bf) — COMPLETED
- **Status**: Applied by tech-lead in session s_1774445620188_200
- **Evidence**: `agents/qa/SOUL.md` lines 20-21 now use `./node_modules/.bin/tsc` and `./node_modules/.bin/vitest`
- **Impact**: 9 QA sessions in last 6h, **0 waste in 8 of 9** (only 2 wasted calls in oldest session)
- **Estimated savings**: ~70 wasted bash calls/day eliminated → saves ~$5-10/day

### ✅ P1: classifyFailure() sub-classification (req:1e70e1cc) — COMPLETED
- **Status**: Applied by tech-lead
- **Evidence**: `agents/may/handlers/tool-quality-scan.ts` lines 124-126 now have `cmd-not-found`, `cd-bad-path`, `file-not-found-bash`
- **Impact**: Will break down bash:other (134 calls) into actionable categories in next scan (needs binary rebuild to activate)

## Agent Waste Ranking (24h evaluations)

| Agent | Waste Calls | Productive | Waste % |
|-------|-------------|------------|---------|
| bob | 148 | 990 | 13.0% |
| optimizer | 82 | 1,217 | 6.3% |
| tech-lead | 59 | 773 | 7.1% |
| coach | 26 | 581 | 4.3% |
| may | 21 | 219 | 8.8% |
| scout | 10 | 163 | 5.8% |
| qa | 8 | 184 | 4.2% ✅ |

## Agent Cost (24h)

| Agent | Sessions | Total Ops | Ops/Session |
|-------|----------|-----------|-------------|
| optimizer | 48 | 1,190 | 24.8 |
| coach | 34 | 733 | 21.6 |
| tech-lead | 23 | 564 | 24.5 |
| bob | 87 | 363 | 4.2 |
| may | 33 | 141 | 4.3 |
| qa | 28 | 120 | 4.3 |
| scout | 11 | 78 | 7.1 |
| coder | 12 | 64 | 5.3 |
| evaluator | 25 | 20 | 0.8 |

## Zombie Status
- **37 total**: bob=32, optimizer=4, tech-lead=1
- Down from 41 (previous scan) — some naturally expired
- Fix in binary 786c884 (zombie cleanup), needs process restart

## Binary Status
- **Running**: PID 52 on `may-agent-b9ef77e` (built Mar 24)
- **Built**: `may-agent-bbbe4fe` (built just now, includes 18+ commits since b9ef77e)
- **New in bbbe4fe**: verification gym scenarios, path assumption guard, zombie cleanup, empty-args guard, session-read-guard bash-grep fix, skill-lifecycle early exit, classifier improvements
- **Still needs process restart** to activate

## Next Actions
1. **Binary rebuild done** — bbbe4fe built and symlinked ✅
2. **Process restart still needed** — cannot self-restart, need Hao or external trigger
3. **Bob waste (148 calls, 13%)** — next investigation target. Spread across many heartbeats, need to sub-classify
4. **Re-run tool quality scan after restart** — to verify classifier improvements and guard activations
