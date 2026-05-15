# Federation Heartbeats

Each instance writes `{instance}.json` here on every auto-commit cycle.
Used to detect when an instance goes down (stale heartbeat > 30min).

See `projects/federation-design/project.md` §9.1 for format.
