# Federation Heartbeats

Each instance writes `{instance}.json` here on every auto-commit cycle.
Used to detect when an instance goes down (stale heartbeat > 30min).

See `agents/shared/research-projects/federation-design.md` §9.1 for format.
