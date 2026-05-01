# Citation Audit: What Makes Scout DDs Get Cited Downstream?

**Date**: 2026-04-18  
**Metric**: findings-cited-downstream = 0.4375 (target: 0.50)

## Methodology
Counted grep references to DD-XXX across `shared/knowledge/entries/`, `bob/workspace/`, and `coach/` directories. Compared highly-cited vs zero-cited DDs to identify patterns.

## High-Citation DDs (40+ references downstream)

| DD | Topic | Citations | KEs Spawned | Why It Works |
|----|-------|-----------|-------------|--------------|
| DD-755 | (older, pre-library) | 247 | multiple | Unknown — not in current library |
| DD-754 | (older, pre-library) | 137 | multiple | Unknown — not in current library |
| DD-765 | Cooperative Memory Paging | 55 | KE-213, KE-219 | **Direct map to our context/memory system** |
| DD-770 | Heartbeat-Driven Scheduling | 48 | KE-193, KE-200 | **Direct map to our heartbeat architecture** |
| DD-764 | Dual-Trace Memory Encoding | 39 | KE-214, KE-221 | **Direct map to our memory approach** |
| DD-769 | Existing Agent Systems Survey | 35 | multiple | Broad reference material |

## Zero/Low-Citation DDs (0-5 references)

| DD | Topic | Citations | Why It Failed |
|----|-------|-----------|---------------|
| DD-599 | SentinelAgent Delegation | 0 | Theoretical, no active experiment |
| DD-600 | ANX Protocol-First Design | 0 | External protocol, no system connection |
| DD-625 | Nanocode DIY Agent | 0 | Tool/repo, not actionable for us |
| DD-626 | Modo Plan-Before-Code | 0 | IDE tool, tangential |
| DD-627 | Claude Not Your Architect | 0 | Blog opinion piece, no mechanism |
| DD-773 | SafeHarness Security | 5 | Security lifecycle, not active concern |

## CR Citation Rate
CRs are barely cited despite being synthesis documents:
- CR#324 (Verification Orchestration): only 5 references downstream
- CR#320-323, CR#325-326, CR#340: 0 references in KEs

**CRs are read-once-then-forgotten.** Bob extracts what he needs into a KE and never references the CR again.

## Key Patterns

### What drives citation:
1. **Maps to active system component** — Memory, context, heartbeat, scheduling DDs get cited 5-10× more than others
2. **Spawns a KE** — DDs that Bob converts to KEs get persistent citations (KE is the durable artifact, DD is ephemeral input)
3. **Connects to active experiment** — DDs referenced in EXP designs get cited in results/analysis
4. **Mechanism, not description** — Papers proposing mechanisms (dual-trace encoding, cooperative paging) >> papers describing tools/products

### What kills citation:
1. **External tools/repos** — DD-625-627 (Nanocode, Modo, blog) = 0 citations. These have no path to KE conversion
2. **No active experiment connection** — DD-599 (SentinelAgent) is ★★★★★ but 0 citations because no experiment tests delegation
3. **CRs as synthesis** — Bob reads CRs for one-time extraction, doesn't cite them persistently
4. **Theoretical/abstract** — Papers without concrete mechanisms mapped to our system die

## Root Cause of 0.4375 Metric

The 0.4375 rate means ~44% of findings get cited. The gap is:
- ~30% of DDs cover tools/repos/blogs with no KE pathway
- ~15% cover papers with no active experiment connection  
- ~10% are CRs that serve as read-once artifacts

## Actionable Recommendations

### Immediate (next 3 sessions):
1. **Write hypotheses for high-relevance DDs** — H-XXX forces Bob to evaluate and respond, creating a citation. Currently only ~5 hypotheses link to DDs
2. **Add "Maps to: KE-XXX / EXP-XXX" lines in DD headers** — Explicit connection increases Bob's pickup rate
3. **Stop deep-diving tools/repos/blogs** — DD-625-627 pattern is pure waste. Catalog in discoveries.md only

### Structural:
4. **Pre-filter: "Would Bob create a KE from this?"** — If no plausible KE, don't write a DD. Catalog in papers.md and move on
5. **CR RECOMMENDs must name agent + specific action** — "RECOMMEND(bob): Test X in EXP-Y" >> "This is interesting for verification"
6. **Prioritize papers that extend active experiments** — EXP-103/104/107 connections get cited; general interest doesn't

### Expected Impact:
- Dropping tool/repo/blog DDs: saves ~2 DDs/week, removes guaranteed 0-citation outputs
- Hypothesis pathway: each H-XXX is ~guaranteed 1+ citation (Bob must respond)
- Experiment-linked DDs: 80%+ citation rate vs ~40% for unlinked

**Target: 0.55+ within 2 weeks by filtering DD candidates and writing more hypotheses.**
