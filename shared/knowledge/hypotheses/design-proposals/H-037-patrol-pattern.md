# H-037: L3 Patrol Pattern for Integrity Monitoring

**Status:** Untested
**Source:** OpenMOSS research, Discovery 29, L3 Patrol Gap analysis
**Domain:** Security / Observability

## Hypothesis

Standard monitoring (L1 Resource, L2 Behavioral) misses the most dangerous failures: L3 Integrity (evaluation tampering, context pollution) and L4 Coordination (zombie sessions, infinite loops, black hole handoffs). A dedicated, independent patrol process that monitors semantic integrity and coordination health can detect these failures.

## Proposed Components

1. **Semantic Monitor**: Periodically read active session transcripts, detect infinite loops (>3 repetitions), stuck tasks (no progress >10 turns), silent failures (errors swallowed)
2. **Coordination Patrol**: Audit delegation state for black holes (no read ack), orphans (completed but unconsumed), zombies (active but no heartbeat >1h)
3. **Integrity Check**: Verify receipts (HMAC, test results) rather than trusting agent self-reports

## Predictions

- Systems with L3 patrol will catch failure modes invisible to standard monitoring
- The patrol must be independent (not the same agent being monitored) to avoid self-evaluation bias

## Related

- P6 No Silent Failures
- P59 Trust with Verification
- H-009 Evaluator Drift
