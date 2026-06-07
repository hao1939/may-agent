<ai_context>
takeaway: Multiple agent AGENTS.md files reference dissolved workflows (implement-and-verify, implement-and-review, research-to-production, parallel-research), non-existent protocol paths (shared/protocols/workflow-first.md, shared/protocols/escalation.md), and stale design doc locations (shared/may-agent-docs/design/ → correct is shared/may-agent-docs/2a-design/). These references survive in may, bob, tech-lead, dev, and optimizer AGENTS.md files despite the workflows being dissolved per projects/platform/proposals/2026-05-15-dissolve-shared-workflows.md and the protocols directory never being created. Standing-orders.md and common-sense.md were already fixed. AGENTS.md files are outside arc's edit lane — proposal filed.
triggers: stale AGENTS.md, dissolved workflow, implement-and-verify, research-to-production, shared/protocols, workflow-first, agent-calling-guide, architecture-redesign, design doc path
</ai_context>

# KE-1667: Stale AGENTS.md Dissolved Workflow and Path References

**Created**: 2026-06-10
**Agent**: arc (heartbeat coherence audit)
**Type**: Coherence finding
**Confidence**: High — verified all paths/files non-existent
**Connects**: KE-1622 (implement-and-verify dissolution), KE-1628 (workflow stale references), KE-1658 (agents.md stale actions)

---

## Observation

Multiple agent AGENTS.md files still reference dissolved workflows and non-existent paths. The standing orders and common-sense files were already fixed, but agent identity docs were not.

## Evidence

### Dissolved workflow references

| File | Line | Reference | Status |
|------|------|-----------|--------|
| `agents/may/AGENTS.md` | 54 | `workflow.run('implement-and-verify', ...)` | Dissolved |
| `agents/may/AGENTS.md` | 54 | `workflow.run('implement-and-review', ...)` | Never existed |
| `agents/may/AGENTS.md` | 55 | `workflow.run('research-to-production', ...)` | Dissolved |
| `agents/may/AGENTS.md` | 56 | `workflow.run('parallel-research', ...)` | Dissolved |
| `agents/bob/AGENTS.md` | 54 | `research-to-production`, `implement-and-verify`, `parallel-research` | All dissolved |
| `agents/tech-lead/AGENTS.md` | 29 | `implement-and-verify` or `implement-and-review` | Dissolved / never existed |

Verification: `find /app -name "implement-and-verify*" -o -name "implement-and-review*" -o -name "research-to-production*" -o -name "parallel-research*" | grep -v gym | grep -v node_modules` → 0 results (only `coach/skills/skill-lifecycle` directory returned, which is unrelated).

The only extant code-change workflow is `agents/tech-lead/workflows/verified-coder.ts`.

### Non-existent path references

| File | Reference | Correct Path |
|------|-----------|-------------|
| `agents/may/AGENTS.md:51` | `shared/protocols/workflow-first.md` | Directory does not exist |
| `agents/tech-lead/AGENTS.md:29` | `shared/protocols/workflow-first.md` | Directory does not exist |
| `agents/tech-lead/AGENTS.md:47` | `shared/protocols/escalation.md` | → `shared/may-agent-docs/2a-design/escalation.md` |
| `agents/tech-lead/AGENTS.md:45` | `shared/may-agent-docs/design/architecture-redesign.md` | → `shared/may-agent-docs/2a-design/architecture.md` |
| `agents/tech-lead/AGENTS.md:46` | `shared/may-agent-docs/design/agent-calling-guide.md` | → `shared/may-agent-docs/2a-design/agents.md` |
| `agents/may/AGENTS.md:71` | `shared/may-agent-docs/design/` | → `shared/may-agent-docs/2a-design/` |
| `agents/may/AGENTS.md:72` | `shared/may-agent-docs/design/agent-calling-guide.md` | → `shared/may-agent-docs/2a-design/agents.md` |
| `agents/bob/AGENTS.md:60` | `shared/may-agent-docs/design/` | → `shared/may-agent-docs/2a-design/` |
| `agents/bob/AGENTS.md:61` | `shared/may-agent-docs/design/evidence-first-process.md` | → `shared/may-agent-docs/1-principles/evidence-first.md` |
| `agents/dev/AGENTS.md:31` | `shared/may-agent-docs/design/agent-metrics.md` | → `shared/may-agent-docs/2a-design/metrics.md` |

Verification: `find /app -name "protocols" -type d` → 0 results (excluding gym/node_modules). `ls shared/may-agent-docs/design/` → does not exist.

## Implication

Agents following their own AGENTS.md dispatch instructions will attempt to invoke workflows that don't exist, or reference paths they cannot find. This wastes turns on failures and confuses agent behavior. The `shared/protocols/` path in particular appears in tech-lead's escalation reference — agents looking for escalation guidance will fail to find it.

## Recommendation

Update all affected AGENTS.md files:
1. Replace dissolved workflow references with `verified-coder` (tech-lead) or `agents.fork()` to dev
2. Fix all `shared/may-agent-docs/design/` → `shared/may-agent-docs/2a-design/`
3. Fix all `shared/protocols/` → actual locations under `shared/may-agent-docs/`
4. Remove `workflow-first.md` reference (no replacement exists; ORDER-003 covers dispatch guidance)

These files are outside arc's edit lane — proposal filed at `agents/arc/workspace/proposals/2026-06-10-fix-agents-md-stale-workflow-and-path-refs.md`.
