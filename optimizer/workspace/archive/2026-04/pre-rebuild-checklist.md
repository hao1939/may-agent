# Pre-Rebuild Verification Checklist

**Previous binary**: 849c340 (PID 58)
**New binary built**: 501bc8b (built 2026-04-01 08:49, symlink updated)
**HEAD**: 8914e46 (Phase 3 EventBus — 2 commits ahead of binary)
**Binary status**: Symlink points to 501bc8b but process NOT restarted. PIDs 7 & 58 still running 849c340.
**Commits in new binary**: 7 (849c340..501bc8b: 01e382b, 85a9ad3, d84c785, e58e521, 5c44520, 501bc8b)

## When the binary is rebuilt, verify:

### 1. maxTurns enforcement (d84c785)
- **What**: `maxTurns` was a dead variable in cron.ts — the session loop never checked it
- **Expected**: Bob heartbeat sessions should cap at configured maxTurns (30)
- **Verify**: `SELECT agent, opCount FROM sessions WHERE agent='bob' AND task LIKE '%heartbeat%' ORDER BY startedAt DESC LIMIT 10` — all should be ≤ 30 ops
- **Finding**: agents/optimizer/workspace/finding-maxTurns-not-enforced.md
- **Note**: Bob's recent sessions are already 12-40 ops naturally, so the fix is mainly a safety net against spikes like the 114-op session seen on Mar 31

### 2. New gym baseline needed
- **Action**: Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "d84c785-maxTurns-fix"`
- **Compare against**: 849c340 baseline (15/16 pass, 94%)
- **Expected**: No regression — maxTurns fix shouldn't affect gym (gym sessions are short)

### 3. Hot-reload handler fix (fd5b559)
- **What**: Handler modules now hot-reload on each cron invocation
- **Verify**: Check if handler changes take effect without binary restart

### 4. Agent calling redesign (80b52a9)
- **What**: call/fork/message/context actions replaced old run/send
- **Cost implications**: fork creates new independent sessions (could increase session count)
- **Verify**: Monitor 24h session count — should stay ~160/day unless new features increase traffic

### 5. CLI agent support (dc7595b, 5e8e58b, bfa0c35, b236294, 937a532, 849c340, 01e382b, 85a9ad3)
- **What**: Claude Code, Codex, Gemini CLI tools added
- **Cost implications**: CLI agents run externally — different cost model
- **Verify**: Check if CLI agent sessions are tracked and evaluated correctly

### 6. Chat-mode session tracking (ed4a0c5)
- **What**: Socket/telegram UI sessions now tracked
- **Verify**: New sessions should appear in DB with proper agent attribution

### 7. Test repairs (b382c00, aee8a66)
- **What**: 28 failing tests fixed, .state/ excluded from vitest
- **Verify**: `npx vitest --run` should have no unexpected failures

---
*Created 2026-04-01T07:39 by optimizer*
*Update this file after each binary rebuild*
