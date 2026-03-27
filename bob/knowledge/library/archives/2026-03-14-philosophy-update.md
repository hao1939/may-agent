## Philosophy Update
### New: P117 Process Lifecycle — from: P53 Zombie Incident
A running process is not truth; it is a snapshot of the past.
To trust the code on disk, the process must be able to restart itself cheaply and safely.
**Principle**: "The only way to patch memory is to kill the process."
**Corollary**: Never run a critical system without a supervisor (e.g., systemd, pm2, while-loop).
### Revised: P110 Active Recall — was: "Search before generation", now: "Search before generation; Restart before trust."
Added clause about process freshness.
### Open Questions:
- Should we force a restart on every deployment? (Yes)
- Should we add `agents.restart()` capability to May? (Risk: Loops)
