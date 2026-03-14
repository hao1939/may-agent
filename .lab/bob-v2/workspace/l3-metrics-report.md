# L3 Delegation Metrics Report

Source: `.state/delegations.jsonl` (59 records)

## Executive summary
- Total delegation events: **59**
- By method: **37 send** / **22 call**
- Overall status mix: **14 success** / **37 sent** / **8 error**
- Call reliability: **14/22 success (63.6%)**, **8/22 error (36.4%)**
- Most common call error (6/8, 75% of errors): **stopReason "toolUse" but no tool call content blocks** → likely streaming/proxy truncation.

## Volume (top parents / children)
### Top parents
- `bob`: **50**
- `coach`: **4**
- `unknown`: **4**
- `optimizer`: **1**

### Top children
- `may`: **17**
- `tech-lead`: **13**
- `evaluator`: **8**
- `optimizer`: **7**
- `coach`: **6**
- `coder`: **4**
- `may-path-fix`: **2**

## Call performance (method = `call`)
Call durations (22 calls with `durationMs`):
- p50: **73,307 ms**
- p90: **234,943 ms**
- p95: **263,712 ms**
- max: **832,286 ms**

### Call success rates by child (children with ≥1 call)
- `evaluator`: **4/4 success (100%)** — p50 9,425 ms; max 73,307 ms
- `coder`: **3/3 success (100%)** — p50 14,442 ms; max 15,978 ms
- `may-path-fix`: **2/2 success (100%)** — p50 26,845 ms; max 91,601 ms
- `bob-growth-test`: **1/1 success (100%)** — 107,743 ms
- `bob-lab-test`: **1/1 success (100%)** — 101,182 ms
- `tech-lead`: **2/5 success (40%)** — p50 138,791 ms; max 234,943 ms
  - Top errors: (2) stopReason toolUse/no tool blocks; (1) empty response (0 tokens)
- `optimizer`: **1/6 success (16.7%)** — p50 189,488 ms; max 832,286 ms
  - Top errors: (4) stopReason toolUse/no tool blocks; (1) Unexpected end of JSON input

## Error taxonomy (all methods)
Errors observed (8 total):
1. **6×** `LLM returned stopReason "toolUse" but no tool call content blocks were present` (proxy/stream truncation likely)
2. **1×** `Unexpected end of JSON input` (partial/truncated JSON)
3. **1×** `Model returned an empty response (0 output tokens)` (model/API issue)

## Notes / interpretation
- Errors are dominated by **response truncation/empty output** signatures rather than domain/task failures.
- `optimizer` and `tech-lead` calls show notably lower reliability and higher latencies than other children in this sample.
