# Finding: Socket-Based Config Reload

**Date**: 2026-03-27T14:03
**Impact**: Critical — resolved 40+ hour Bob outage

## Problem
Bob's agent.json was updated to "opus" model (replacing deprecated "gemini-3-pro-preview") at ~11:34 on Mar 27, but PID 52 never reloaded the config. The running process only reads agent.json at startup.

## Solution Discovered
The running process exposes a Unix socket at `.state/instances/console/may.sock` that accepts JSON commands. The `reload_agents` command triggers `handleReload()` in may.ts, which re-reads all agent.json configs without requiring a process restart.

### Command
```bash
echo '{"type":"reload_agents"}' | socat - UNIX-CONNECT:.state/instances/console/may.sock
```

### Result
```
{"type":"ok","command":"reload_agents"}
{"type":"info","message":"[reload] 10 updated (master, amy-kimi, judge, optimizer, bob, amy, tech-lead, may, evaluator, qa)"}
```

## Notes
- The default socket at `.state/instances/default/may.sock` returned "Connection refused" — use the console socket instead.
- scout, coder, coach showed missing config field warnings — expected, they use cron.json configs not agent.json.
- Other available socket commands: `close`, `subscribe`, `status`, `input`, `run`, `reload_agents`, `restart`.
- The `status` command shows active sessions.

## Future Use
This technique can be used anytime agent configs need hot-reloading without a full process restart. Should be documented as a standard operations procedure.
