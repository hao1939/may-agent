# Brief: Fix Context Loading Gap & Standardize Heartbeats

## 1. Context Loading Fix (Immediate)
**Problem**: `src/lib/manager.ts` currently constructs the system prompt from `SOUL.md` + `knowledge/INDEX.md` but *ignores* `DOMAIN.md`. This causes agents to lose their domain definitions unless manually added to `agent.json`.
**Impact**: Agents are "flying blind" regarding their specific domain constraints.
**Solution**:
- Update `src/lib/manager.ts` (inside `AgentLoader` or `SubagentManager`) to include `DOMAIN.md` if it exists.
- **Constraint**: `LESSONS.md` should remain excluded (handled via RAG/Tool, not System Prompt) or explicitly included if low-volume.
- **Verification**: `read` a system prompt or check `manager.ts` logic.

## 2. FM-3.3 Standardization (Batch)
**Problem**: 4 agents (Amy-Kimi, Evaluator, Master, May) are missing the standard "FM-3.3 Verification Discipline" in their `heartbeat.md`.
**Impact**: Inconsistent verification behavior across the fleet.
**Solution**:
- Inject the standard `0c. ⛔ Verification Discipline` section into:
  - `agents/amy-kimi/heartbeat.md`
  - `agents/evaluator/heartbeat.md`
  - `agents/master/heartbeat.md`
  - `agents/may/heartbeat.md`
- **Constraint**: Do not overwrite existing agent-specific instructions. Insert after `0b. File Reading Guard`.

## Deliverables
1. `src/lib/manager.ts` (or `agent-loader.ts`) updated to load `DOMAIN.md`.
2. 4 `heartbeat.md` files updated.
