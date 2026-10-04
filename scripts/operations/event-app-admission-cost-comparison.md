# Event → App admission bounded-cost comparison

Compared candidates:

- **Discarded direct/hybrid route ledger:** `fix/durable-route-preplan-recovery-20261004` at `3667d2e18` (schema and recovery query).
- **Selected Event marker:** this branch, based on `a8424fe4eca9bede4213c056b9e81701bc89ddf6` plus the accompanying tests/index change.

This is a row-operation/query-plan comparison, not an elapsed-time benchmark. Counts below are for one newly journaled Event and one App durable route. Both candidates also pay the unchanged Event payload, trace, correlation, and admission-plan costs, so those common costs are excluded.

| Boundary | Direct/hybrid route ledger | Event marker |
|---|---:|---:|
| Initial journal transaction | 1 Event INSERT + 1 `event_durable_routes` INSERT | 1 Event INSERT containing `app_admission_pending=1` |
| Accepted-work acknowledgement | 1 route-ledger UPDATE plus the existing Event receipt UPDATE | 1 existing Event receipt UPDATE that also clears the marker |
| Inspected no-work acknowledgement | 1 route-ledger UPDATE | 1 standalone Event marker UPDATE (no receipt is invented) |
| Recovery candidate scan | 1 indexed ledger scan with LEFT JOIN to plans, limit 16 | 1 partial-index Event scan, window 64, processing batch 16 |
| Recovery bookkeeping before row load | 1 route-ledger `updated_at` UPDATE per selected pre-plan Event | none |
| Event reconstruction | 1 Event row/body load per selected Event | 1 Event row/body load per selected Event |
| Addressed-message lost-ack check | absent; the discarded candidate did not preserve a previously accepted recipient across owner remap | 1 `origin_event_id` lookup using partial index `idx_app_inbox_origin_event`, then no new inbox write when found |

Thus the marker removes one table, one index, one INSERT for every Event, one UPDATE for ordinary accepted work, and the per-recovery-attempt bookkeeping UPDATE. Its explicit cost is the same one UPDATE on the uncommon no-work path and one indexed origin lookup on addressed-message recovery. The origin lookup initially planned as a table scan; the production-path `EXPLAIN QUERY PLAN` regression exposed that real defect, so this candidate adds the partial index rather than describing the scan as bounded.

## Reproduction

Run:

```sh
bun test src/app/composition/direct-event-recovery.test.ts
```

The suite executes production persistence and App admission. It asserts:

1. marker recovery uses `idx_events_app_admission_pending` for
   `WHERE app_admission_pending = 1 AND id > ? ORDER BY id LIMIT 64`;
2. addressed-message origin recovery uses `idx_app_inbox_origin_event` for
   `WHERE origin_event_id = ? LIMIT 1`;
3. no-work acknowledgement clears the marker with zero inbox, Task, or model rows;
4. a real second-process SQLite writer lock leaves marker=1 and no plan before registry N is replaced by N+1.

To inspect the discarded comparison source directly:

```sh
git show 3667d2e18:src/lib/db/schema.ts | sed -n '209,225p'
git show 3667d2e18:src/app/composition/app-inbox-runtime.ts | sed -n '720,790p'
git show 3667d2e18:src/lib/db-writer.ts | sed -n '900,925p'
```

Limitations: this report counts SQLite statements/rows and verifies access paths; it does not claim latency, I/O, cache, or contention measurements. Admission-plan writes are intentionally excluded because both candidates use the same plan store after first successful routing.
