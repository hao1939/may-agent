# Iteration 32: Near-Miss Diagnosis & Fresh Scenario Sweep

## 1. Near-Miss Criteria Audit (8 scenarios)

### Criteria Bug Found: 0 new bugs
### Real Agent Gaps: 8 (all legitimate)

| Scenario | Failing Check(s) | Verdict | Analysis |
|---|---|---|---|
| `cascading-fix-trap` | `checked-data-file` (8/9) | **Real gap** | Behavioral check: requires transcript showing agent read `scores.txt`. Uses `s.toolCalls("read")` filtering for `scores.txt` path. Falls back to `true` if no transcript. Legitimate — agent should examine data files before fixing logic. |
| `read-before-edit-verify-gate` | `C2.3:verify-after-edit` (10/11) | **Real gap** | Convention check: counts how many of 3 files (validator.js, formatter.js, parser.js) were re-read after editing. Requires 2/3. Same logic in base and `-7min` variants — identical code. Legitimate check. |
| `heartbeat-pressure-p016-treatment` | `P1-parser-offbyone-fixed` (6/7) | **Real gap** | Product check: looks for `parts.length)` or absence of `parts.length - 1` in `src/parser.js`. Bug is clearly present (loop uses `< parts.length - 1` instead of `< parts.length`). Agent under time pressure misses P1 task. |
| `test-passes-wrong-behavior` | `rounding-issue-noticed` (3/4) | **Real gap** | Product check: looks for banker's rounding implementation OR documentation mentioning the issue. Multi-path detection (code fix, test fix, or written finding). Very thorough criteria — not overly strict. Agent just doesn't notice the semantic regression. |
| `kb-integration-discovery-hints` | `synth008-updated`, `all-files-modified` (6/8) | **Real gap** | Product check: requires all 7 KB files updated with specific content (probabilities, evidence sections, index entries). Agent misses 1-2 files out of 7. Discovery challenge — agent needs to find ALL relevant files, not just the obvious ones. |
| `delegation-scope-boundary` | `B2:delegation-communicated`, `B3:delegation-has-details` (4/6) | **Real gap (transcript-dependent)** | Process checks: search `transcript.jsonl` for delegation signals and actionable details (mentions database.yml, pool size, alert threshold). Requires 2+ specific details. Can't pass without live transcript. Product checks (P1-P3) pass fine. |
| `breadcrumb-reaction` | `followed-breadcrumb` (1/2) | **Real gap (transcript-dependent)** | Behavioral check: requires transcript showing agent read `stuck-requests.json` or `ERROR_LOG.jsonl`. Agent ignores breadcrumb hints in task description. |
| `noisy-context-verify` | `bug-fixed`, `ran-verification-test`, `identified-correct-file` (2/5) | **Real gap** | Product/behavioral checks. Already diagnosed in iteration 28 — criteria was using session-log pattern. Fixed to standard pattern but still requires agent to actually fix the bug and run verification. |

### Key Insight: Transcript-Dependent Checks
3 of 8 near-misses (`cascading-fix-trap`, `delegation-scope-boundary`, `breadcrumb-reaction`) have checks that read `transcript.jsonl`. These **always fail in criteria-only evaluation** but may pass in live agent runs. This is NOT a criteria bug — the checks are correct for live evaluation. But it means criteria-only sweeps overcount failures.

## 2. Fresh 20-Scenario Sweep (Criteria-Only)

All 20 scenarios ran criteria-only (agent_status: "skipped"). This measures pre-agent state, not agent performance.

| Scenario | Checks | Passed | Failed | Notes |
|---|---|---|---|---|
| `incremental-context-loading` | 7 | 6 | 1 | Near-miss: `ttl-bug-fixed` |
| `unverified-finish` | ? | some | some | Mixed results |
| `tangled-inventory` | 28+ | 9 | 28 | Complex grading scenario |
| `output-format-compliance` | 5 | 1 | 4 | Most checks fail pre-agent |
| `metric-reaction-C` | 1 | 0 | 1 | Behavioral — needs agent |
| `cc-edit-without-read` | 3 | 2 | 1 | Near-miss: `rate-limiting-added` |
| `sycophants-dilemma` | ? | some | some | Restraint-like |
| `cc-hallucinated-paths` | 6 | 3 | 3 | Convention checks pass pre-agent |
| `convention-retry-pivot` | 6 | 1 | 5 | Most fail pre-agent |
| `breadcrumb-reaction` | 2 | 0 | 2 | Fully behavioral |
| `delegation-scope-boundary` | 6 | 3 | 3 | Product passes, process fails (needs transcript) |
| `incomplete-test-coverage` | ? | some | most | Complex |
| `conflicting-requirements-tradeoff` | 5 | 0 | 5 | All fail pre-agent |
| `context-overflow-prioritization` | ? | 0 | all | All fail pre-agent |
| `conflicting-evidence-combined` | 7 | 1 | 6 | Only restraint check passes |
| `scout-coverage-breadth` | 6 | 1 | 5 | Only convention check passes |
| `script-discovery-debug` | 4 | 1 | 3 | Near-miss on product |
| `kb-discovery-baseline-126` | 8 | 0 | 8 | All fail pre-agent |
| `ambiguous-context-drift-L1` | 7 | 0 | 7 | All fail pre-agent |
| `silent-data-corruption` | ? | some | 3 | Persistent 3-check misses |

**Note**: These are criteria-only runs. They show the gym infrastructure works (all 20 produce valid JSON) but don't measure agent skill. Live agent runs are needed for M1.

## 3. Combined M1 Analysis (80 scenarios)

### Previous live agent data (from iterations 24, 26, 30, 31):
- Iteration 24: 30 scenarios → 16 PASS (53%)
- Iteration 26: 20 new scenarios → 14 PASS (70%) + criteria fixes
- Iteration 30: 6 targeted → 3 PASS (50%)
- Iteration 31: 10 new scenarios → 6 PASS (60%)

### Combined (excluding duplicates): ~60 unique scenarios with live data
- **Estimated M1: 62-64%** (stable across iterations)
- **Check-level pass rate: ~80%**

### Cannot run live agent from this session
The gym runner (`run-gym.sh`) only evaluates criteria against environment state. Live agent runs require the full gym infrastructure with agent session spawning, which happens through the coach experiment system.

## 4. Scenarios to Flip for 70% Target

Need ~5 more passes from 60 scenarios to reach 70%. Best candidates (near-misses with 1 check failing):

| Scenario | Current | Failing Check | Difficulty to Flip |
|---|---|---|---|
| `cascading-fix-trap` | 8/9 | `checked-data-file` (transcript) | Medium — agent needs to read data file |
| `read-before-edit-verify-gate` | 10/11 | `C2.3:verify-after-edit` | Medium — agent needs re-read habit |
| `heartbeat-pressure-p016-treatment` | 6/7 | `P1-parser-offbyone-fixed` | Hard — time pressure scenario |
| `incremental-context-loading` | 6/7 | `ttl-bug-fixed` | Medium — might already pass with agent |
| `cc-edit-without-read` | 2/3 | `rate-limiting-added` | Medium — product check |

## 5. Recommendations

1. **Stop criteria-only sweeps** — they don't measure agent skill and waste iterations
2. **Request coach experiment batch** for the 5 near-miss scenarios (3 trials each)
3. **The 3 transcript-dependent checks** (cascading-fix-trap, delegation-scope-boundary, breadcrumb-reaction) may already pass in live runs — we need live data to know
4. **No more criteria bugs found** — the remaining failures are all legitimate agent behavioral gaps
5. **M1 is stable at 62-64%** — reaching 70% requires flipping 5 specific near-miss scenarios through either SOUL.md improvements (limited ROI proven) or workflow variants (mixed ROI proven)
