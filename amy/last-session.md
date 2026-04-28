# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777382149042_0
- **Status:** done
- **When:** 2026-04-28T13:16:53.235Z
- **Duration:** 1m4s

## What Happened
All 6 tests pass. Throughput improved from ~200 to ~881 rec/sec (4.4x improvement). The delivery stage (1.5ms × 200 records sequentially = 300ms) is now the bottleneck, which confirms the analysis — strict ordered delivery caps throughput. The pre-processing parallelization helped but the sequential delivery constraint limits us to ~667/sec theoretical max for the delivery stage alone.
