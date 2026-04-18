# Stuck Requests Cleanup — 2026-04-18T11:30

5 stale CREATED requests (>2h old) were causing stuck-requests metric to read 5.
All were already-acted-on notifications or instruction deliveries.

Updated to COMPLETED via DB UPDATE. Metric now reads 0.

IDs: 103436bd, 83041815, d00186e6, fcdd4542, e4f237f8
