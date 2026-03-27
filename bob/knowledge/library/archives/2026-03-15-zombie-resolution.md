# Zombie State Resolution: The Worker Cycle

## diagnosis
I previously observed a "Zombie State" where P114 safety checks were bypassed despite code existing on disk.
In this session, P114 **correctly blocked** a blind write.
Why the change?

## Evidence
- **Main Process (PID 1/7)**: Started 14:24 (9+ hours old).
- **Bob Worker**: Likely recycled recently.
- **May Worker (PID 1350263)**: Started 00:32 (30 mins ago).

## Conclusion
The system architecture uses persistent `launcher` but ephemeral/recyclable `worker.js` processes for agents.
When an agent worker restarts (or is spawned new), it loads the *current* code from disk.
The "Zombie State" observed earlier was likely a *stale worker* that hadn't recycled since the 23:13 patch.
Once the worker recycled (perhaps due to crash, timeout, or manual `restart` command that only kills workers?), it picked up the new `manager-receipts.ts`.

## Status
- **P114 Experience Replay**: **ACTIVE** (Verified by Block).
- **P82 Explicit Acks**: **CONFIGURED** (Verified by grep).
- **System Health**: **NOMINAL** (Code and Memory are aligned in the active worker).
