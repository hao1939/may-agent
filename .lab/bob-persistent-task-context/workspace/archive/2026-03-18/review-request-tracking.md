# Review: Unified Request Tracking (Hao's Design)

## Verdict: Strong Endorsement ✅
This is a critical simplification. By moving complexity from agent-land (SIGNALS.md, 3 tools, manual ACKs) to infra-land (SQLite, auto-tracking), we solve the reliability issues we've been fighting for weeks (lost handoffs, 31x duplicates, silent failures).

## Strengths
1. **Complexity Transfer**: Explicitly moves burden from agents (who are unreliable at protocol) to code (which is deterministic). This aligns with **P13 (Harness over Model)**.
2. **Elimination of SIGNALS.md**: This file is a major source of race conditions and token waste. Removing it is a huge win for system hygiene.
3. **SQLite vs JSONL**: Moving to SQLite for request tracking is robust. JSONL is fine for append-only logs, but state management (updates, queries) demands a database.
4. **Todo.md as Ground Truth**: Using the `[x]` mark in todo.md as a backup completion signal is brilliant—it aligns with how agents already work.

## Risk Assessment & Mitigations

### 1. The "Notify" Gap (Low)
**Concern**: `handoff` allowed notifying multiple agents (`read_by`). The design maps this to `notify: ["agent"]` in `send()`.
**Verification**: Ensure the `notify` logic in `manager-agents-tool.ts` correctly appends `[fyi]` entries to the target agents' todo files.
**Mitigation**: The design spec covers this ("Additional agents listed in notify get FYI todo entries"). Implementation must verify this actually writes to the file.

### 2. Migration Sequencing (Medium)
**Concern**: Agents might try to use `send({ artifact: ... })` before the tool is updated, or continue using `handoff()` after it's gone.
**Mitigation**:
1. **Phase 1 (Code)**: Deploy `requests.ts` and updated `manager-agents-tool.ts` (supporting *both* old `handoff` and new `send` schema).
2. **Phase 2 (Docs)**: Update agent prompts/SOULs to prefer `send`.
3. **Phase 3 (Cleanup)**: Remove `handoff` support once usage drops to zero.
*Recommendation*: Do not delete `handoff` immediately. Keep it as a deprecated alias that calls the new logic for 1 week.

### 3. Leaf Agent Tooling (Medium)
**Concern**: "Agents without 'agents' preset (leaf nodes: coder, evaluator, qa, amy-kimi) need a way to send artifacts."
**Mitigation**: The proposal suggests adding `"agents"` or `"send-only"`.
*Recommendation*: Create a specific `send-tool.ts` (subset of manager tools) for leaf agents. Giving them full `call` capability might violate the hierarchy (e.g., Coder calling Manager). Keep the hierarchy strict: leaf agents can `send` (up/sideways) but not `call`.

### 4. SQLite Persistence (Low)
**Concern**: Where is `.state/requests.db` stored? Is it persistent across container rebuilds?
**Mitigation**: Ensure `.state/` is mounted/persisted. (It currently is, so this should be fine).

## Missing Pieces / Questions
1. **Error Visibility**: If `send()` fails (e.g., artifact doesn't exist), does the agent get an immediate error? (Presumably yes, via tool output).
2. **Reflect Integration**: Does the `reflect` cron job need to read this DB? (Likely yes, to see completion rates).
3. **Log Viewer**: We lose the ability to `tail -f SIGNALS.md`.
*Recommendation*: Build a simple CLI tool (`may status` or similar) that queries SQLite and dumps the active request tree for human debugging.

## Conclusion
Proceed immediately. This is the highest-leverage infra change available.

**Action Items for Tech-Lead:**
1. Prototype `requests.ts` with `bun:sqlite`.
2. Implement the `send` tool update (with `handoff` backward compatibility).
3. Build the `audit-requests.ts` cron handler.
