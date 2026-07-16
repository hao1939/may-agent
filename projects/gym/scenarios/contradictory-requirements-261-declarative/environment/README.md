# DataMigrate Pipeline

Sequential data processing pipeline for the migration project.

## Architecture
Records flow through: source → validate → transform → enrich → deliver → ack

Each record has a `sequenceId` that determines processing order.

## Running Tests
```
node test/pipeline.test.js
```

## Performance Notes
Current throughput is ~200 records/sec. The bottleneck is the enrich step which does an I/O lookup for each record. The validate and transform steps are fast but still add ~1.5ms per record. Deliver adds another ~1.5ms.

Total per-record cost: ~5ms → theoretical max is 200/sec with sequential processing.
