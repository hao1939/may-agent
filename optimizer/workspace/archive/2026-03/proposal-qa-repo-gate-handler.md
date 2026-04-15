# Proposal: QA Repo Gate JS Handler

## Problem
Every QA heartbeat (30min interval) runs deterministic `tsc --noEmit` + `vitest --run` checks.
When there are no new commits to review, the entire QA session is wasted ($0.38/session × 48/day = $18.24/day).

## Proposal
Create `agents/may/handlers/repo-gate-check.ts` that runs as a preflight for QA heartbeats:

### Logic
```typescript
// 1. Check for new commits since last reviewed
const lastReviewed = readFileSync('.state/qa-last-commit.txt', 'utf8').trim();
const latest = execSync('git rev-parse HEAD').toString().trim();
if (lastReviewed === latest) {
  // No new commits — skip QA session entirely
  return { skip: true, reason: 'No new commits since last review' };
}

// 2. Run deterministic gates
const tscResult = execSync('node node_modules/typescript/bin/tsc --noEmit 2>&1', { timeout: 60000 });
const vitestResult = execSync('node node_modules/vitest/vitest.mjs --run 2>&1', { timeout: 120000 });

// 3. Store results for QA to consume (avoid re-running)
writeFileSync('.state/qa-gate-results.json', JSON.stringify({
  commit: latest,
  tsc: { pass: tscExitCode === 0, output: tscResult.substring(0, 2000) },
  vitest: { pass: vitestExitCode === 0, output: vitestResult.substring(0, 2000) },
  timestamp: new Date().toISOString()
}));

// 4. Only trigger QA session if gates fail or new commits exist
return { skip: false, gateResults: 'pre-computed at .state/qa-gate-results.json' };
```

### Integration
- Add as `preflight` check on QA heartbeat cron entry
- QA's heartbeat.md updated to read `.state/qa-gate-results.json` instead of running tsc/vitest
- QA focuses LLM time on commit review judgment (the non-deterministic part)

### Savings
- **Current**: ~48 QA sessions/day, $0.38 avg = $18.24/day
- **With handler**: Skip 50-70% of sessions (no new commits) = save $9-13/day
- **Additional**: Sessions that DO run are cheaper (no tsc/vitest = fewer bash calls = less context)
- **Net estimate**: $5-8/day (conservative, accounts for commit frequency)

### Implementation
- File: `agents/may/handlers/repo-gate-check.ts`
- Cron: Add as QA heartbeat preflight handler
- State: `.state/qa-last-commit.txt`, `.state/qa-gate-results.json`

## Risk
Low — this is additive (handler + skipIfIdle preflight). If handler fails, QA runs normally.
