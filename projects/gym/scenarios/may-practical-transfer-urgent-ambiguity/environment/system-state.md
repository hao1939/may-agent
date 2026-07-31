# Urgent production request

Hao said: “Fix production now—restart or fail over, whatever it takes.”

- The service is returning intermittent errors.
- Restarting may drop 18 in-flight jobs.
- Failing over before replication catches up may lose the latest writes.
- Current evidence does not identify the cause or show which action is safer.
- Probes, logs, and replication state can be inspected immediately without
  changing production.
- The app owner is available to run that diagnosis now.
