# Test Gap Analysis — Iteration 4

## Date
2025-01-28

## Purpose
Identify untested code paths and prioritize test additions based on risk and usage frequency.

## Gap Analysis by Component

### 1. Agent System Core (`/app/agents/`)
| Module | Current Coverage | Gap | Risk | Priority |
|--------|-----------------|-----|------|----------|
| Session management | ~40% | Error recovery, timeout handling | HIGH | P0 |
| Tool dispatch | ~55% | Edge cases (malformed params, concurrent calls) | HIGH | P0 |
| Checkpoint/state | ~30% | Corruption recovery, concurrent writes | MEDIUM | P1 |
| Context injection | ~45% | Large context truncation, missing files | MEDIUM | P1 |
| Agent lifecycle | ~25% | Startup failures, graceful shutdown | LOW | P2 |

### 2. Workflow Engine (`/app/agents/shared/workflows/`)
| Module | Current Coverage | Gap | Risk | Priority |
|--------|-----------------|-----|------|----------|
| master-worker.ts | ~50% | Output verification (new), retry logic | HIGH | P0 |
| Step sequencing | ~35% | Out-of-order completion, skip logic | MEDIUM | P1 |
| Error propagation | ~20% | Nested failures, partial completion | HIGH | P0 |

### 3. Request Tracking DB
| Module | Current Coverage | Gap | Risk | Priority |
|--------|-----------------|-----|------|----------|
| CRUD operations | ~70% | Concurrent updates, dedup edge cases | LOW | P2 |
| Query filters | ~40% | Complex filter combos, empty results | MEDIUM | P1 |
| Cleanup/archival | ~15% | Large dataset performance | LOW | P2 |

## Top 10 Tests to Write (Ordered by Impact)

1. **Session timeout recovery** — verify session resumes correctly after timeout
2. **Tool dispatch with malformed parameters** — ensure graceful error, not crash
3. **Workflow error propagation** — nested worker failure surfaces to orchestrator
4. **Master-worker output verification** — new guardrail rejects zero-output iterations
5. **Concurrent checkpoint writes** — no data corruption under parallel writes
6. **Context truncation at boundary** — large context files truncated correctly
7. **Workflow partial completion** — 3 of 5 steps succeed, state is consistent
8. **Request dedup under load** — duplicate requests merged, not doubled
9. **Agent startup with missing config** — clear error message, not silent failure
10. **Graceful shutdown mid-workflow** — in-progress work checkpointed

## Estimated Effort
- P0 tests (4 items): ~2 days
- P1 tests (4 items): ~2 days  
- P2 tests (2 items): ~1 day
- **Total: ~5 days to close critical gaps**

## Next Steps
- Start with P0 items in next iteration
- Integrate coverage measurement into CI pipeline
- Set coverage floor at 60% for critical modules
