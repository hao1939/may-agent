# TODO

- [2026-03-05] LLM-to-JS audit: Review recent session transcripts and agent tool usage. Identify patterns where an LLM call is doing work that could be replaced by deterministic JS code (e.g., template-based responses, formulaic evaluations, simple lookups, data formatting). For each pattern found, log it in Tracking with the agent name, what the LLM does, and a sketch of the JS replacement. Propose the highest-impact replacement as a structural fix.

# Tracking

- [2026-03-05] LLM-to-JS replacement opportunities — ongoing watch. Review each optimizer run for cases where agents make LLM calls that follow a predictable pattern (same input shape → same output shape, no reasoning required). Examples to look for: aborted session evaluations (always 0/0), simple file existence checks wrapped in agent calls, template-based status reports. Goal: reduce cost and latency by replacing these with JS code in the runner/tools.
