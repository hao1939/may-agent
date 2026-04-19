# Citation Audit: Findings Cited Downstream

**Date**: 2026-04-19  
**Metric**: "Findings cited downstream" = 0.4375 (target: 0.5)  
**Method**: Grep DD#/CR# references in knowledge-entries/, experiments/, hypotheses/, bob/, coach/ directories

---

## Summary

Of ~120 deep dives and ~40 cross-references produced, downstream citation (in KEs, experiments, hypotheses, Bob/Coach files) is concentrated on:
- **Well-cited**: DD#516 (19 cites in hypotheses), DD#496, DD#495, DD#765, DD#487, DD#485, DD#481, DD#777 (6 cites in KEs)
- **Recent well-cited**: DD#770, DD#771, DD#773, DD#764, DD#769, DD#777-779 (all from INBOX — Bob triaged)

**Key pattern**: Items in INBOX.md that Bob explicitly triaged get cited. Items NOT in INBOX or not flagged for triage go uncited.

---

## High-Value UNCITED Findings (Priority Pickup)

### Tier 1 — Directly Actionable for Current Work

| ID | Title | Why It Matters |
|----|-------|----------------|
| **CR#335** | Error Propagation Lifecycle ★★★★★ | Multi-session context authority + inherited confabulation. Directly relevant to production FM-3.3 investigation. |
| **CR#338** | Cognitive Overhead Budget ★★★★★ | Mechanistic explanation for gate stacking hump curve. Critical for guard architecture decisions (KE-134/135). |
| **CR#337** | Exemplar-Induced Fixation | Explains EXP-130 -67pp iatrogenic effect. Grounds few-shot injection risks. |
| **CR#332** | Closing KE-105 Gaps | Dynamic capability profiles + multi-step attack detection. Fills remaining KE-105 gaps. |
| **CR#327** | Production-First Evaluation | Case for observational assessment — directly addresses gym-production gap (3 blocked experiments). |
| **CR#329** | Next-Gen Evaluation Architecture | Adaptive, state-aware, length-resistant evaluation. Extends CR#327. |

### Tier 2 — Useful External Grounding

| ID | Title | Why It Matters |
|----|-------|----------------|
| **DD#705** | daVinci-Env (ByteDance OpenSWE) | 45K executable environments — potential gym redesign reference. |
| **DD#755** | AgentGym-RL (ICLR 2026 Oral) | Multi-turn RL training framework. Relevant to self-improvement research. |
| **DD#758** | RExBench — Agents Can't Do Research Extensions | All agents fail at research extension tasks. Calibrates expectations. |
| **DD#708** | Prompt Attack/Defense Cases | Three attack categories with defense patterns. |

---

## Root Cause Analysis

**Why 0.4375 instead of 0.5?**

1. **INBOX bottleneck**: Bob triages from INBOX.md. Recent DD#763-779 were all in INBOX → all got triaged. But CR#327-338 and many DDs from sessions 390-415 never made it to INBOX explicitly.

2. **CR gap**: Cross-references are cited far less than deep dives. Only 8 unique CRs cited downstream vs 31+ unique DDs. CRs synthesize multiple findings but aren't surfaced for triage.

3. **Language barrier**: Several uncited items (DD#708, DD#740-743, DD#747-748, DD#752, DD#754, DD#756, DD#774-776) are Chinese-language hotboard entries. These may not be as discoverable.

4. **Volume outpaces consumption**: ~120 DDs + ~40 CRs is massive. Bob/Coach can only absorb so many per session.

---

## Recommendations

### R1: Add CRs to INBOX.md triage queue
Cross-references are the highest-value-per-item outputs (they synthesize multiple DDs) but aren't in the triage pipeline. Add CR#327, CR#329, CR#332, CR#335, CR#337, CR#338 to INBOX.

### R2: Create "Priority Pickup" section in INBOX
Flag 3-5 items per week as "highest downstream value" with one-line actionability notes. Reduces Bob's triage burden.

### R3: Scout should write explicit "Flag for Bob" in INBOX entries
The todo.md already contains "Flag for Bob" notes — but these stay in Scout's workspace. Push them to INBOX.md where Bob actually reads.

### R4: Tag CRs with experiment/KE they extend
E.g., "CR#335 → extends KE-122, KE-123" makes it immediately clear who should read it.

### R5: Reduce hotboard volume for non-English sources
Chinese-language hotboard entries have near-zero downstream citation. Consider summarizing only the highest-signal ones (★★★★+) in English.

---

## Immediate Actions

1. ✅ Write this audit
2. → Notify Bob about Tier 1 uncited findings  
3. → Notify Coach about CR#335 (error propagation) and CR#338 (cognitive overhead)
4. → Update INBOX.md with CR entries
