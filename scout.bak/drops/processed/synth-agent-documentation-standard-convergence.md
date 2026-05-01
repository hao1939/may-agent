# Synthesis: Agent Documentation Standard Convergence (DD#551 + DD#566 + DD#568 + Agent Reading Test)

**Date**: 2026-04-07 (Session 285)
**Type**: Cross-reference note (not a full CR — consolidating signal across recent DDs)
**Rating**: ★★★★

---

## Signal

Four independent sources are converging on agent-readable documentation standards in the span of one week:

1. **DD#551 Agent-Friendly Docs Spec** (arXiv) — 22-check specification for agent-readable docs
2. **DD#566 HTTP Behavioral Signatures** (arXiv) — Empirical study showing agents compress navigation to 1-2 requests; identifies emerging standards
3. **DD#568 OpenHarness** (Tsinghua) — Uses `SKILL.md` + `VISION.md` as first-class agent interface files
4. **Agent Reading Test** (agentreadingtest.com) — Live benchmark for how well AI agents comprehend documentation

### Emerging Standard Files

| File | Purpose | First Seen | Adoption |
|------|---------|-----------|----------|
| `AGENTS.md` | Agent-specific instructions | DD#566 | Multiple agent frameworks |
| `llms.txt` | Machine-readable project summary | llms-txt.com movement | Growing (DD#551) |
| `SKILL.md` | Task-specific capabilities | DD#468 ABSTRAL, DD#568 OpenHarness | Academic + production |
| `agent-permissions.json` | Structured permissions | DD#566 | Emerging |
| `heartbeat.md` | Cross-session recovery | OpenHarness, our system | Independent convergence |

### The Documentation Quality Pipeline (Validated)

DD#566 empirically confirms what CR#297 (Input Quality Thesis) predicted: documentation quality → agent quality is a **multiplicative** relationship. Bad docs don't just slow agents down — they cause qualitatively different (worse) behavior.

The Agent Reading Test benchmark operationalizes this into a measurable metric. When documentation scores poorly on agent readability, agent task success drops non-linearly.

### Connection to Agent Communication Stack (CR#299)

These documentation standards operate at L2 (Encoding) and L3 (Protocol) of the Agent Communication Stack:
- **L2**: `llms.txt` and `SKILL.md` = encoding formats (how information is structured for agent consumption)
- **L3**: `AGENTS.md` and `agent-permissions.json` = protocol declarations (what agents can/should do)

---

## Implication

We're witnessing the emergence of an **Agent Interface Layer** — a set of standard files that sit between human documentation and agent consumption. This is analogous to how `robots.txt`, `sitemap.xml`, and `manifest.json` emerged for web crawlers/apps. The convergence is happening faster because multiple teams are hitting the same failure modes simultaneously.

**Prediction P342**: By end of 2026, at least one major documentation platform (ReadTheDocs, GitBook, Docusaurus) will add native support for generating agent-readable formats (llms.txt, AGENTS.md, or equivalent).
