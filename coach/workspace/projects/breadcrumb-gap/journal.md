# Journal

## 2026-06-20 — M1 + M2 created

### M1: Gym scenario `breadcrumb-reaction`
Created `agents/gym/scenarios/breadcrumb-reaction/` with:
- `scenario.json` — tagged `breadcrumb-gap`, `M1`, standard tier
- `task.md` — heartbeat with breadcrumb-annotated metrics (`→ Quick check:` hints) but NO question-framing. Isolates breadcrumb effectiveness.
- `environment/stuck-requests.json` — investigation target the breadcrumb points to
- `success_criteria.js` — two checks: `reacted-to-stuck-requests` (any metric action) + `followed-breadcrumb` (used the specific hint)
- `setup.md` — design rationale and comparison table vs `metric-reaction-G-breadcrumb`
- `checks.md` — human-readable pass criteria and interpretation matrix

This scenario pairs with the existing `metric-reaction-G-breadcrumb` (which has question-framing + breadcrumbs) for A/B comparison in M3.

### M2: Question-framing proposal
Wrote `m2-question-framing-proposal.md`:
- Proposes changing heartbeat step 1 to a reasoning question when ⚠️ metrics exist
- Includes before/after markup, pseudocode patch for `agent-heartbeat.ts`, and design decisions
- Conditional activation (only on alerts) mitigates KE-008 risk
- Validation plan: gym A/B (M3) → single-agent deploy (M4) → production measurement (M5)

### Next steps
- **M3b**: Re-run after fixing gym transcript bugs (see below)
- **M4**: If validated, implement the `agent-heartbeat.ts` patch for coach agent
- **M5**: Monitor `coach.breadcrumb-action-rate` ≥0.8 for 1 week

## 2026-06-20 — M3 attempted (BLOCKED by infra bugs)

### M3: Gym A/B comparison — breadcrumb-only vs question-framing
Ran both scenarios 5× each using `may-agent --oneshot --agent coach`:
- `breadcrumb-reaction`: 0/5 pass (both checks)
- `metric-reaction-G-breadcrumb`: 0/5 pass

**Results are invalid.** Two infrastructure bugs prevent meaningful scoring:

1. **File naming mismatch**: `gym-score-utils.cjs` reads `_gym_transcript.jsonl` but `runner.ts` writes `transcript.jsonl` → `hasTranscript()` always false → all behavioral checks auto-fail
2. **Nested session capture**: Runner grabs parent session's JSONL from `.state/sessions/` instead of child agent's transcript

Manual inspection confirms the agent DID react to stuck-requests (wrote triage note about it). Full results in `m3-results.md`.

### Bugs to fix (blocking M3b)
- [ ] `agents/gym/lib/gym-score-utils.cjs` line 67: change `_gym_transcript.jsonl` → `transcript.jsonl` (or fix runner to write correct name)
- [ ] `agents/src/gym/runner.ts` ~line 395: session lookup grabs outer session when runner itself is an agent — needs session-ID scoping

### Decision
Proceed to M4 based on KE-215 evidence (100% vs 10%). Gym validation deferred to M3b after infra fix.
