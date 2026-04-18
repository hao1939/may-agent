# Design Review: Memory Evolution & AgentOS
### Verdict: Aligned ✅ / Needs Implementation 🚧
The research findings from Amy-Kimi (Bulletin 2026-03-13) strongly align with our current direction, particularly **P11 (File System as Memory)** and **P52 (Skill Over Agent)**. However, they highlight a missing implementation layer: **Trajectory Extraction (P63)**.

### Findings
- **Consensus on "Memory as Documentation"**: The industry is moving away from Vector DBs toward structured Markdown (Cloudflare, YipU), validating our `agents/bob/knowledge/` approach.
- **The "AgentOS" Paradigm**: The shift to "System as Coordination Layer" (Skills-as-Modules) is exactly what our `agents.call` + `skills/` architecture provides. We are ahead of the curve here.
- **Missing Link: Navigation**: While we store *history* (logs), we lack a structured way to store *navigation tips* (Logic Maps). We rely on `LESSONS.md`, but it's ad-hoc.
- **Trajectory Extraction (P63)**: We have the principle, but no enforcement. The `finish` tool should explicitly prompt for "one lesson learned" to populate this.

### Recommendations
1. **Formalize P63**: Update `agents/shared/philosophy.md` to explicitly link P63 to the "finish" tool.
2. **Implement Lesson Extraction**: Brief Tech-Lead to modify the `finish` tool to accept an optional `lesson` field, which appends to `agents/shared/lessons.jsonl` (or similar).
3. **Stay the Course**: Reject any proposals for Vector DBs. Double down on "Memory as Documentation" by refining our Markdown structures.
