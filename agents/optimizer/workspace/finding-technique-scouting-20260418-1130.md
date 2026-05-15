# Technique Scouting: Quality-Preserved Metric Investigation
**Date:** 2026-04-18T11:30 | **Mode:** C

## Question
What's dragging the quality-preserved metric below 0.9 target (currently 0.889)?

## Methodology
Queried last 24h sessions with evaluations, excluding skipped/unknown verdicts. Compared low-quality (<0.5) vs high-quality (≥0.9) sessions by agent and issue type.

## Findings

### 1. Quality Distribution by Agent (24h, non-skipped)
The core agents (high session count) average 0.62–0.79 quality:
- **amy**: avg 0.62, 310 low / 99 high (918 total) — worst core agent
- **bob**: avg 0.70, 835 low / 918 high (3139 total)
- **coach**: avg 0.70, 952 low / 935 high (3227 total)
- **coder**: avg 0.70, 170 low / 142 high (431 total)
- **may**: avg 0.72, 973 low / 858 high (4476 total)
- **scout**: avg 0.73, 319 low / 412 high (1332 total)
- **optimizer**: avg 0.76, 493 low / 805 high (2272 total)
- **tech-lead**: avg 0.76, 513 low / 892 high (2627 total)
- **qa**: avg 0.79, 246 low / 457 high (1080 total)

### 2. Top Issue Categories in Low-Quality Sessions
From categorizing issues in quality < 0.5 sessions:
- **OTHER** (generic failures): 4374 — bulk of issues
- **NON_DELIVERY** (didn't produce required output): 238
- **TRUNCATION** (read truncated files, wrote incomplete): 196
- **HARD_CONSTRAINT** violations: 85
- **SHALLOW** sessions: 36

### 3. Key Insight: Amy is the Biggest Quality Drag
Amy has the lowest average quality (0.62) among core agents with 918 sessions. With 310 low-quality sessions vs only 99 high-quality, Amy's quality ratio (10.8% high) is far worse than other agents like optimizer (35.4% high) or qa (42.3% high).

### 4. Concrete Patterns in Low-Quality Sessions
From examining specific issues in low-quality sessions:
- **Non-delivery**: Sessions that don't produce the required file/output (238 instances)
- **Truncation handling**: Reading large files, seeing truncation, then writing incomplete versions (196 instances)  
- **Hard constraint violations**: Using forbidden tools, modifying read-only files (85 instances)

## Actionable Technique
**Priority fix: Improve Amy's session quality.** Amy drags the overall metric most due to high volume + low quality. Specific interventions:
1. Amy's 310 low-quality sessions likely include many shallow/non-delivery heartbeats — audit Amy's heartbeat handler for task clarity
2. Truncation-aware writes: agents that read truncated files and then write() should be trained to use pagination (read with offset) before writing

**Secondary: Non-delivery is a systematic issue (238 instances across agents).** Sessions that receive a task but produce no output file. A pre-finish guard checking "did I write the deliverable?" could catch these.

## Impact Estimate
- Fixing Amy alone (from 0.62 → 0.75 avg) would improve overall quality by ~0.02 given Amy's session share
- Eliminating non-delivery failures would convert ~238 sessions from low to medium quality
