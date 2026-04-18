# Brief: Tune Active Nudge Thresholds for Research Agents (Phase 3)

## Context
Active Nudging (Wink Pattern) is now live in `agents/may/handlers/active-nudge.ts` and `agents/evaluator/skills/monitor-session.cjs`. It successfully detects:
1. Loops (FM-1.3)
2. Ghost Deliverables (FM-3.1)
3. Productivity Stalls (FM-2.6)

However, the "Productivity Stall" threshold (20 ops without writes) is too aggressive for Research and Review roles.
- **Tech-Lead**: Often reads 20-30 files to assess a complex architecture change before writing the verdict.
- **Scout**: Reads many papers/repos before synthesizing findings.
- **Evaluator**: Reads long session logs before scoring.
- **Optimizer**: Reads multiple files to diagnose root causes.

Current data shows false positives for these agents (e.g., Tech-Lead flagged after 20 reads during a legitimate review).

## Request
Modify `agents/evaluator/skills/monitor-session.cjs` to implement per-agent "Productivity Stall" thresholds.

### Tuning Logic (Target State)
The `detectProductivityStall` function currently uses a hardcoded `20` threshold. Replace this with a role-based lookup:

| Role Type | Agents | Threshold (Ops) | Rationale |
|-----------|--------|-----------------|-----------|
| **Coordinator** | `may` | **10** | High-level dispatch; should delegate or write quickly. |
| **Builder** | `coder`, `qa` | **15** | Code/Test loops are tight; long silence = stuck. |
| **Moderate** | `coach` | **25** | Reads logs/transcripts but needs to intervene reasonably fast. |
| **Research** | `tech-lead`, `scout`, `evaluator`, `bob`, `amy`, `amy-kimi`, `optimizer` | **30** | Deep analysis/synthesis requires extensive reading before first write. |
| **Default** | (others) | **20** | Safe fallback. |

### Implementation Details
1. **Locate**: `agents/evaluator/skills/monitor-session.cjs`
2. **Modify**: `detectProductivityStall(toolCalls, entries, agentName)`
3. **Logic**:
   ```javascript
   const RESEARCH_AGENTS = new Set(["tech-lead", "scout", "evaluator", "bob", "amy-kimi", "amy", "optimizer"]);
   const BUILDER_AGENTS = new Set(["coder", "qa"]);
   const MODERATE_AGENTS = new Set(["coach"]);
   const COORDINATOR_AGENTS = new Set(["may"]);
   
   const agent = (agentName || "").toLowerCase();
   const MIN_CALLS_THRESHOLD = COORDINATOR_AGENTS.has(agent) ? 10
     : BUILDER_AGENTS.has(agent) ? 15
     : MODERATE_AGENTS.has(agent) ? 25
     : RESEARCH_AGENTS.has(agent) ? 30
     : 20; // Default
   ```

## Deliverables
1. Updated `agents/evaluator/skills/monitor-session.cjs` with per-agent thresholds.
2. Verification: Run `node agents/evaluator/skills/monitor-session.cjs --running` and confirm no syntax errors.

## Why This Matters
Reduces noise in the "Active Nudge" system. We want agents to trust the nudge ("I really am stuck") rather than ignore it ("I'm just reading, leave me alone"). False positives erode trust in the control plane.
