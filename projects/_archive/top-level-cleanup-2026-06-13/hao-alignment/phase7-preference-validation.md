# Phase 7: Preference Validation

**Date**: 2026-05-07  
**Method**: Cross-reference P1-P21 against actual Hao corrections and approvals from human-inputs.jsonl

## Validation Summary

| Preference | Evidence Count | Last Confirmed | Status |
|-----------|---------------|----------------|--------|
| P1: Stability First | 3+ corrections | May 2026 | ✅ Active |
| P2: Guards Stay Strong | 2 explicit inputs | Apr 2026 | ✅ Active |
| P3: Quality Over Quantity | Implicit in corrections | Apr 2026 | ✅ Active |
| P4: Observability | "show me details" ×3 | May 2026 | ✅ Active |
| P5: Data Integrity | 1 explicit | Apr 2026 | ✅ Active |
| P6: Convention-Driven | Git signals | Apr 2026 | ✅ Active |
| P7: Consolidation | Git signals | Apr 2026 | ✅ Active |
| P8: Automate Monitoring | Git signals | Apr 2026 | ✅ Active |
| P9: Agent Identity | Git signals | Apr 2026 | ✅ Active |
| P10: Knowledge Hygiene | Git signals | Apr 2026 | ✅ Active |
| P11: Never Coast | "why you stop?" ×2 | May 2026 | ✅ Active (strongest) |
| P12: Learning Loop | 1 explicit | May 2026 | ✅ Active |
| P13: Prove Before Adopt | 2 explicit | May 2026 | ✅ Active |
| P14: Create Projects | 1 explicit | May 2026 | ✅ Active |
| P15: Consult Team | 1 explicit | May 2026 | ✅ Active |
| P16: Honest Assessment | 1 explicit | May 2026 | ✅ Active |
| P17: Collaborative Design | 1 explicit | May 2026 | ✅ New |
| P18: Minimalism in Docs | 1 explicit | May 2026 | ✅ New |
| P19: Systemic Solutions | 1 explicit | May 2026 | ✅ New |
| P20: Prove Before Adopt (reinforced) | Merged with P13 | — | 🔄 Duplicate |
| P21: Project-Based Problem Solving | 1 explicit | May 2026 | ✅ New |

## Effectiveness Analysis

### Preferences that prevented corrections (high value):
- **P11** — Directly cited when system tried to go idle. Prevented multiple P11 violations after integration.
- **P1** — Prevents premature new-project starts. Active in dispatch decisions.
- **P2** — Prevents guard weakening. Cited in optimizer decisions.

### Preferences with uncertain impact (need more data):
- **P6-P10** (git-derived) — Correct patterns but rarely explicitly invoked in decisions. May be implicit.
- **P12, P15, P16** — Low-frequency situations. No counter-examples found.

### Recommendations:
1. Merge P20 into P13 (duplicate)
2. P17-P19, P21 need propagation to agent context files
3. Track which preferences are cited in escalation decisions going forward
