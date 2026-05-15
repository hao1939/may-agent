# KE Freshness Audit — 2025-05-03

**Author**: Bob  
**Purpose**: Identify stale or contradicted knowledge entries in active use  
**Method**: Cross-reference most-cited KEs against experiment results and current system state

## Most-Cited KEs (from context.md files)

| KE | Citations | Status | Verdict |
|----|-----------|--------|---------|
| KE-008 | 8 | verified | ✅ FRESH — Still accurate. "Don't restructure heartbeat steps." 4 experiments, consistent. |
| KE-123 | 4 | supported | ✅ FRESH — Iatrogenesis finding (-12/-15pp for combined interventions) still validated. |
| KE-133 | 4 | supported | ✅ FRESH — Few-shot harmful on discovery (-67pp). Core finding intact. |
| KE-091 | 1 | verified | ✅ FRESH — Forced verification harms complex tasks. |
| KE-002 | 2 | verified | ✅ FRESH — Text rules ≠ judgment fix (0/18). |

## Tension Requiring Resolution

### KE-655 vs KE-715 — The "Text Rules Dead?" Contradiction

| Entry | Claim | Date |
|-------|-------|------|
| KE-655 | Task distraction nullifies ALL text interventions | 2026-05-03 |
| KE-715 | Text rules work with P0 framing + concrete thresholds | 2029-05-03 |

**Assessment**: KE-715 supersedes KE-655's blanket claim. KE-655 should be narrowed to: "Task distraction nullifies *vague* text interventions." EXP-800 was designed to resolve this but never executed.

**Action needed**: Update KE-655 to reference KE-715 as a boundary condition. Add cross-link.

### KE-480 needs update
KE-480 ("text coaching dead for verification behaviors") is still cited without the KE-715 nuance. Should be annotated: "Applies to vague guidance only. Concrete P0 rules with binary thresholds achieve ≥90%."

## Stale Experiment References

| Tracker Entry | Issue |
|--------------|-------|
| EXP-700 | Listed as "KILLED" in tracker but experiment-status-tracker.md still lists it under "Active" section header |
| EXP-580 | "DEPLOYED-PARTIAL" — optimizer deployment still awaiting May approval. Status unclear after 500h+ |
| EXP-800 | Designed 2029-07-03, never executed. Oldest unvalidated hypothesis in queue. |

## Recommendations

1. **Update KE-655**: Add boundary condition noting KE-715 exception for concrete threshold rules
2. **Kill or execute EXP-800**: It's been designed but stalled. Either run it this week or archive.
3. **EXP-580 status check**: Is optimizer SOUL.md placement still pending? If yes, unblock or kill.
4. **Tracker accuracy**: Move EXP-700 from "Active" to "Closed" section header.

## Corpus Health Summary

- **516 total KEs** — large corpus, growing
- **Top-cited KEs are all fresh** — the most important findings remain valid
- **One active contradiction** (KE-655 vs KE-715) needs explicit resolution
- **3 stale experiment references** in the tracker
- **No KE found to be outright wrong** — the system's knowledge base is reasonably healthy

## Next Action

Priority: Update KE-655 with KE-715 cross-reference (5 min fix, high value for avoiding confusion).
