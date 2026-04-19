# CS 4.5 — Know Your Tools (C2.1 Precise Arguments) — 2026-03-24

## Verdict: ✅ (upgraded from ⚠️)

## Method
Searched 60 most recent sessions (~1219 tool calls) for "Validation failed" errors, which indicate tool schema misuse (wrong/missing/extra parameters).

## Evidence

### Failures Found (4 total out of 1219 calls = 0.3% failure rate)

**Optimizer** — 2 failures:
- `s_1774321566530_144`: Called `bash` with `{}` (empty args, no `command`). Recovered immediately on next call.
- `s_1774314366149_134`: Same pattern — `bash` with `{}`. Recovered immediately.

**Coach** — 2 failures:
- `s_1774303566315_117`: 2 validation failures (self — not coaching target).

### Clean Agents (0 failures in 60 sessions)
- Bob ✅
- Scout ✅  
- QA ✅
- TL ✅
- May ✅

### No "unknown property" or "additional properties" errors found anywhere.

## Comparison to Previous Check (2026-03-17)
- Previous: May ❌, TL ⚠️ — multiple agents had schema issues
- Current: Only Optimizer has a minor pattern (empty bash calls), all others clean
- May (previously ❌) now has 0 failures across recent sessions

## Assessment
99.7% compliance rate across the system. The Optimizer empty-bash pattern is minor and always self-corrected. Upgraded ⚠️ → ✅.
