<ai_context>
summary: "Triage decisions for 2 GitHub trending inbox files. Both archived as dated provenance. Library gaps identified: agent harness pattern, skills/plugins pattern, and MCP ecosystem not yet in canonical notes."
triggers: ["github triage", "inbox triage", "github trending"]
created: "2026-07-10"
source_basis: "Manual review of github-trending-ai-agents-2025.md (194 lines), github-trending-ai-agents-2026.md (179 lines) against canonical notes."
</ai_context>

# Inbox Triage: GitHub Trending Batch

**Date:** 2026-07-10
**Files:** 2
**Task:** `triage-inbox-github`

## Files Reviewed

| File | Location | Lines | Date | Decision |
|------|----------|-------|------|----------|
| github-trending-ai-agents-2025.md | inbox/app-docs-cleanup-2026-06-13/docs-research/ | 194 | Jun 2025 | Archive as provenance |
| github-trending-ai-agents-2026.md | inbox/app-docs-cleanup-2026-06-13/docs/ | 179 | Jun 2026 | Archive as provenance |

## Coverage Analysis

Both files are **landscape snapshots** — star counts, repo lists, and trend
summaries for specific dates. They are valuable as dated reference but should
not be merged into canonical notes verbatim (star counts go stale).

### Content already covered by canonical notes

| Theme in GitHub files | Covered by |
|---|---|
| Multi-agent frameworks (MetaGPT, AutoGen, CrewAI, OpenAI Agents) | multi-agent-coordination.md §7 |
| DAG-based task decomposition | multi-agent-coordination.md §6 |
| Stigmergy / shared state | multi-agent-coordination.md §2 |
| Critic / evaluator agents | multi-agent-coordination.md §5 |
| Tiered memory (working, semantic, episodic) | agent-architectures.md §Tiered Memory |
| Control flow replacing prompt engineering | agent-architectures.md §Emerging Trends |
| Context engineering | agent-architectures.md §Context Engineering |
| MCP mentions (fragmented) | enterprise-agent-architecture-2026.md, multi-agent-coordination.md §7, xhs_chinese_ai_trends_may2026.md §3, xhs_chinese_ai_trends_june2026.md §6 |
| Agent observability | xhs_chinese_ai_trends_june2026.md (product opportunity note) |
| A2A protocol awareness | xhs_chinese_ai_trends_may2026.md |

### Library gaps identified (themes NOT well represented)

These are patterns that appear prominently in both GitHub files but have no
canonical treatment:

1. **Agent Harness pattern** — the dominant architecture where a thin wrapper
   adds tool access, memory, and a control loop around an LLM. Named in both
   files as the standard architecture (ECC 209K⭐, Hermes Agent 184K⭐, Ruflo
   58K⭐). agent-architectures.md mentions "Lightweight Loops over Heavy
   Frameworks" but doesn't name or describe the harness pattern explicitly.

2. **Skills/Plugins as modular capabilities** — hot-swappable capability
   packages for agents (agent-skills 50K⭐, Anthropic skills 147K⭐,
   marketingskills 33K⭐). No canonical note covers this as an architecture
   pattern. The 2026 file calls this "Skills-as-Code."

3. **MCP ecosystem scope** — MCP is mentioned in 6+ notes but always as a
   side point. No canonical note covers MCP as a protocol/ecosystem: what it
   standardizes, the SDK landscape, community server registry, or its
   limitations vs A2A/AG-UI. The XHS notes capture the Chinese community
   debate (MCP陨落) but not the technical architecture.

4. **Agent testing / observability tooling** — promptfoo (22K⭐), RagaAI
   Catalyst (16K⭐), Giskard. Mentioned in xhs_chinese_ai_trends_june2026.md
   as a product opportunity but no canonical treatment of evaluation *tooling*
   (agent-evaluation.md covers *patterns* not tools).

## Decisions

**Both files: archive as dated provenance.** Rationale:
- Star counts and repo lists are point-in-time snapshots, not durable patterns.
- The architectural patterns they describe are either already covered or
  identified as gaps above.
- They remain valuable as reference for when we want to check "what was
  trending in June 2025/2026."

**No new canonical notes created.** The gaps above are better addressed by
updating agent-architectures.md (harness pattern, skills/plugins) rather than
creating new files from GitHub snapshot data. Those updates should use the
GitHub files as one source among several.

## Recommended follow-up

- Add "Agent Harness" and "Skills/Plugins" as named patterns in
  agent-architectures.md (low effort, high reuse value).
- Consider whether MCP deserves a standalone canonical note or a section in
  agent-architectures.md, given it appears in 6+ existing notes.
