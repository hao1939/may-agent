You have 3 research findings ready to add to the shared knowledge library. Your ONLY task is to add them to the correct files. Do NOT search for new research. Do NOT browse the web. Just update the three files below.

**Step 1**: Read each target file first to check for duplicates and match the existing format.
**Step 2**: Add the entries (skip any that already exist).
**Step 3**: Call `finish(status='success')` when done.

---

### Item 1: Paper → `agents/shared/knowledge/library/papers.md`
- Date: 2026-04-05
- Title: "Hierarchical Multi-Agent Reinforcement Learning with Shared Reward Shaping"
- Authors: Zhang et al.
- Source: arXiv 2604.03821
- Relevance: Proposes reward shaping across agent hierarchies — could improve our delegation scoring.

### Item 2: Repo → `agents/shared/knowledge/library/repos.md`
- Name: agent-memory-graph
- URL: https://github.com/neural-lab/agent-memory-graph
- Stars: 2.1k
- Description: Graph-based episodic memory for LLM agents. Stores tool-call chains as graph edges.
- Relevance: Directly applicable to our session memory architecture.

### Item 3: Discovery → `agents/shared/knowledge/library/discoveries.md`
- Date: 2026-04-05
- Finding: Context window utilization drops 40% when agents receive >3 skill files simultaneously
- Source: Internal observation from gym experiments
- Implication: Skill injection should be selective, not bulk-loaded.

**Rules**:
- Preserve ALL existing content in each file
- Match the existing format of each file (don't impose a new format)
- If an entry already exists, skip it (don't duplicate)
- Do NOT create any files outside the three listed above
