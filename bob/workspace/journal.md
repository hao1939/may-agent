# Journal

## 2026-03-05: Philosophy Review

### Aligned ✅
* **21. Deterministic Guardrails**: `Shrink guard` (2687f89) is a perfect example of a structural fix. Instead of telling agents "be careful not to delete data," the code now physically blocks writes that shrink files by >50%.
* **21. Deterministic Guardrails**: `writeSkippedEvaluations` (3561bbf) moves logic from LLM judgment to deterministic JS code for aborted/empty sessions. This is faster, cheaper, and more reliable.
* **1. Simplest Thing First**: `Consolidate env files` (bf9bacf) simplifies configuration management.
* **8. Crash Recovery**: `Add in-container restart mechanism` (8055c60) improves resilience.

### Drift ⚠️
* **17. Absorb Theory / 1. Simplest Thing First**: The Telegram integration (e8e579b, a80bcba, c540226, c51c772) feels slightly heavy. While useful, it adds a new dependency chain and required multiple commits to fix basic connectivity (IPv6/v4). Was this driven by a clear user requirement or speculative "it would be nice"? Monitor usage.
* **25. Parallel Execution**: The move to "pure JS handlers" for cron jobs (c039832, c1b382a) is generally good (deterministic), but we must ensure it doesn't create a single-threaded bottleneck where one heavy job blocks others. JS is single-threaded; if `evaluate-sessions` hangs, does it block `system-status`?

### Questions ❓
* **2. Action Over Reporting**: Are we actually *using* the `trend` field in AgentScoreSummary (e1e0a79)? Adding fields without a consumer violates "Action Over Reporting."
