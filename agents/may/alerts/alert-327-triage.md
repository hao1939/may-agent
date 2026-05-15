# Alert 327 Triage: session.first-turn-error-count-1h

**Operation**: downgrade_priority  
**Date**: 2026-05-14  

## Finding

All 7 first-turn errors originate from a single transient provider outage at ~1778753966xxx.
Every agent (scout, may, dev, arc, evaluator) errored simultaneously in that batch.

## Evidence

- Metric trending down: 12 → 7 as errors age out of 1h window
- No recurring pattern; single burst event
- No code defect identified

## Decision

Downgrade priority. Alert will self-resolve as errors exit the 1h window.
No fix needed.
