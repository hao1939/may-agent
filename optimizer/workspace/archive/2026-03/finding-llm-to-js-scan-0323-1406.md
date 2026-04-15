# LLM-to-JS Opportunity Scan — 2026-03-23T14:06

## Summary
Scanned 39 sessions across 5 hours. Total burn: **$56.42/5h → $270/day projected.**

## Agent Cost Breakdown (5h window)
| Agent | Cost | Sessions | Avg | Share |
|-------|------|----------|-----|-------|
| optimizer | $22.99 | 11 | $2.09 | 40.7% |
| coach | $13.39 | 9 | $1.49 | 23.7% |
| tech-lead | $9.55 | 3 | $3.18 | 16.9% |
| bob | $4.22 | 4 | $1.06 | 7.5% |
| scout | $3.06 | 1 | $3.06 | 5.4% |
| qa | $1.51 | 4 | $0.38 | 2.7% |
| may | $1.40 | 5 | $0.28 | 2.5% |
| coder | $0.30 | 2 | $0.15 | 0.5% |

## Key Findings

### F1: Prompt Caching Still 0% (BLOCKED — requires Hao)
**Impact: $36-90/day savings.**
ANTHROPIC_API_KEY still not set. Code deployed (7c86665) but env var missing. Every Claude session pays full input token cost. System prompt is already optimized for stable caching. This is the single biggest cost lever.

### F2: QA Repo Gate Is Fully Deterministic (NEW — JS handler opportunity)
**Impact: $5-8/day savings.**
Every QA heartbeat runs the same 4-step sequence:
1. `git log --oneline -10` (find new commits)
2. `git show --name-only` (inspect commit)
3. `node tsc --noEmit` (type check)
4. `npx vitest --run` (test suite)

Steps 3-4 are 100% deterministic. Step 1-2 is a diff check (new commits since last review).
**Proposal**: JS handler `repo-gate-check.ts` that:
- Runs `tsc --noEmit` and `vitest --run` as child processes
- Stores last-reviewed commit hash
- Only triggers QA heartbeat if: (a) new unreviewd commit exists, OR (b) either gate fails
- Skips QA session entirely if no new commits and both gates pass
At $0.38/session × 48 sessions/day, saving 50-70% of idle QA sessions = $9-13/day savings.

### F3: Optimizer Self-Cost Dominance (RECURRING)
**Impact: Self-awareness item.**
Optimizer = 40.7% of total cost. Two sessions over $4: one Phase 4 DEPLOY at $6.66 (54 ops, 2M input tokens), one heartbeat at $4.85 (50 ops, 1.56M input tokens). Both driven by:
- High op count (50-57 LLM calls per session)
- 0% prompt caching (context re-sent every call)
- Skill-lifecycle DISCOVER phase reads many session transcripts

The $6.66 Phase 4 session is actually a heartbeat doing cost analysis, not really Phase 4. It accumulated 2M input tokens across 57 LLM calls. With prompt caching (90% hit rate), this would be ~$1.50 instead of $6.66.

### F4: Bash-as-Cat Nearly Eliminated (GOOD NEWS)
Pure `cat`/`head`/`tail` bash-as-read calls are now <1% of total bash calls across all agents. The session-read-guard and skill deployments worked. No further action needed.

### F5: Coach Common-Sense-Verify Pattern (KNOWN)
Coach sessions doing common-sense verification grep through session transcripts — this is the same pattern as optimizer's cost analysis. Both inflate context by processing large session data through LLM. The session-read-guard (958fdad) blocks full session.jsonl reads but agents work around it with grep pipelines.

## Actionable Items
1. **[BLOCKED]** Set ANTHROPIC_API_KEY env var → $36-90/day savings (already escalated to Hao)
2. **[NEW]** Build `repo-gate-check.ts` handler → $5-8/day savings (QA skip-if-idle on steroids)
3. **[SELF]** Reduce own heartbeat cost by limiting ops in analysis sessions (budget-before-act compliance)

## Comparison to Previous Scan (2026-03-22T21:15)
- Bash-as-cat: DOWN from 12% to <1% ✓
- QA commit preflight: STILL NOT BUILT (identified again)
- Claude caching: STILL 0% (ANTHROPIC_API_KEY not set)
- Total projected burn: UP from ~$97/day to $270/day (more sessions running post-restart)
