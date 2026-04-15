# Cost & Efficiency Scan — 2026-03-25 10:33 UTC

## Key Findings

### 1. Binary Build Gap: 15+ commits behind running process
- **Running process**: PID 52 → `may-agent-b9ef77e` (from Mar 24)
- **Latest binary**: `may-agent-786c884` (just built, Mar 25 10:38)
- **Commits gap**: 15 commits between b9ef77e and 786c884
- **Impact**: All guards deployed since b9ef77e are inactive:
  - Path Assumption Guard (786c884) — would prevent 28 bash:nonexistent-path errors
  - Zombie Session Cleanup (1d58bd5) — would clean up stale "running" sessions
  - Empty Args Guard improvements
  - Session Read Guard bash-grep fix
  - Ghost Deliverable Guard
  - Skill Lifecycle Early Exit
- **Action needed**: Process restart. PID 52 needs to be killed/replaced.

### 2. Stale Requests Growing: 48 stale (>2h old)
- Mostly "echo hello" and "echo testing*" to bob — diagnostic requests piling up
- Stale requests never get cleaned up — they accumulate indefinitely
- This is visual noise in `--status` output and wastes attention
- **Structural issue**: No TTL/expiry on requests. Old "echo hello" requests should auto-expire.

### 3. Tool Quality — bash:other Dominates Waste (69%)
- **bash:other**: 148 wasted (qa=70, optimizer=36, coach=26, coder=16)
- This is heterogeneous errors (timeouts, unexpected exit codes, parsing failures)
- QA agent is the biggest offender with 70 bash:other errors
- No guard can easily catch these — they're varied bash failures
- **Trend**: bash:other grew from 126→148→150 across last 3 reports (slow growth)

### 4. bash:nonexistent-path Still 28 Errors  
- Coder(16) keeps doing `cd /home/coder` — environment path confusion
- Optimizer(12) also has some
- **Fix ready**: Path Assumption Guard committed (786c884) but needs binary activation
- Expected: This will drop from 28 → near 0 after activation

### 5. empty-args + read:empty-args Stable at 28 Total
- Coach is worst offender (10 read:empty-args, 2 finish:empty-args)
- Guard exists in binary but coach keeps generating these
- May need a prompt-level intervention for coach

### 6. Session Cost Distribution (last 4h, by session.jsonl size)
Top expensive sessions:
- Coach training sprint planning: 675KB (s_158) — 56 ops, 32min
- Bob heartbeat: 284KB (s_167) — interrupted
- Tech-lead: 251KB (s_164) — 28 lines but large content
- Coach sessions: 226KB, 206KB — routine heartbeats
- Optimizer sessions: 182KB, 170KB, 159KB, 156KB — heartbeats + skill lifecycle
- **Pattern**: Coach and Optimizer are still the dominant cost centers

### 7. Zombie Sessions Still Accumulating
- Multiple bob sessions stuck in "running" status (echo testing*, echo verify_bob, etc.)
- Zombie cleanup code exists in 1d58bd5 but isn't active (PID 52 = b9ef77e)
- These zombies inflate "running" counts in status reports

## Binary Build Summary
- Built `may-agent-786c884` at 10:38 UTC
- Includes: Path Assumption Guard, Zombie Cleanup, all previous guards
- Symlink updated: `bundle/may-agent` → `may-agent-786c884`
- **Still needs process restart** to activate

## Recommendations (Priority Order)
1. **Process restart** — highest ROI, activates months of deployed guards
2. **Request TTL** — auto-expire stale requests after 4h (new feature needed)
3. **Coach prompt intervention** — address empty-args pattern (10 read:empty-args)
4. **QA bash:other investigation** — need to understand what QA is doing with 70 bash failures
