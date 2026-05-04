# Experiment Pipeline Status — 2029-07-25

## Active Pipeline

### 🔴 BLOCKED
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-640 | Duration Gate Production Audit | BLOCKED | Binary not rebuilt — TS source changes not in runtime. Escalated to tech-lead 2029-07-23. |
| EXP-630 | Structural Duration Gate | DEPLOYED but INERT | Same as EXP-640 — code exists in source, not in binary. |

### ✅ CLOSED (Recent)
| ID | Name | Result | Date |
|----|------|--------|------|
| EXP-635 | Threat-Framed Depth Commitment | CEILING — baseline 100% in gym | 2029-07 |
| EXP-620 | Gate-Gaming Detection | PARTIALLY SUPPORTED — 27-55% trivial | 2029-07 |
| EXP-615 | Notification-Only Waste Detection | SUPERSEDED — H1 supported (64% shallow) | 2029-07-25 |
| EXP-610 | Write-Depth Gate | CEILING — baseline 100% in gym | 2029-07 |
| EXP-605 | Session Depth vs Quality | H1 SUPPORTED — <90s = 0% artifacts | 2029-07 |
| EXP-600 | Bash Waste Reduction | NEGATIVE — skill didn't reduce waste | 2029-07 |

## Critical Finding: Binary Rebuild Required

The #1 blocker for the entire shallow-session experiment chain is that **the runtime binary does not include any TS source changes** made after its last compilation. This affects:
- EXP-630 duration gate (structural, correct approach)
- EXP-565 verify-after-edit gate (unknown if active)
- Any future structural gates in heartbeat-data.ts

**Until the binary is rebuilt, all structural intervention experiments are on hold.**

## Experiment Chain Summary
```
EXP-605 (observe: <90s=bad) 
  → EXP-610 (gym gate: ceiling)
  → EXP-615 (audit: 64% waste, gate-gaming found)
    → EXP-620 (quantify gaming: 27-55%)
      → EXP-625 (text nudge: skipped per KE-480)
        → EXP-630 (structural gate: deployed but inert)
          → EXP-635 (gym variant: ceiling)
          → EXP-640 (audit: binary not rebuilt) ← CURRENT BLOCKER
```

## Next Steps (When Unblocked)
1. Binary rebuild activates EXP-630 duration gate
2. Wait for 50+ sessions, check `duration-gate-triggers.log`
3. Measure shallow-session rate (target: ≤25%, baseline: ~55%)
4. Write KE based on results

## New Experiment Candidates (If Binary Stays Blocked)
- **EXP-645**: Measure current shallow-session rate to see if text-level interventions (anti-shallow rule, output format) have had any effect since EXP-615's 64% baseline
- **EXP-650**: Cross-agent skill compliance audit — which agents follow skills best/worst?
