# Design Brief: File Provenance (Layer 3 Security)

**Context**: Scout's Cross-Ref #92 proves that our "Open Filesystem" (Layer 3) is a critical vulnerability that invalidates our Ops Gates (Layer 2) and Prompts (Layer 1).

**Problem**: Currently, `write()` is anonymous. If `run_test.js` is modified, we don't know if it was Tech-Lead (trusted) or a hallucinating agent.

**Goal**: Implement **P81 Full-Stack Provenance**. Every file on disk must have a traceable "Last Writer".

## Recommendations

### 1. Extend Ops Receipts (P61)
We already have `.state/ops-receipts.jsonl`. Extend it to capture ALL `write` operations, not just gates.
- **Log Entry**:
  ```json
  {
    "type": "file_write",
    "path": "agents/shared/skills/run_test.js",
    "agent": "tech-lead",
    "session": "s_12345",
    "timestamp": 1773580000,
    "hash": "sha256:..."
  }
  ```

### 2. The `check_provenance` Utility
Create a utility `src/lib/security/provenance.ts` that provides:
- `getLastWriter(path): AgentName | null`
- `isTrusted(path, trustedAgents: string[]): boolean`

### 3. Protection Logic
Update `agent-loader.ts` or specific sensitive tools (like `run_test` or `evaluator` tools) to warn or block if critical files were modified by non-admin agents.
- **MVP**: Just logging is a huge step. We can audit it later.

## Constraints
- **Performance**: Don't make `read()` scan a 1GB log file. Maybe keep a "Latest State" map in memory or a separate `.state/provenance.json` index?
- **P1 Simplest Thing**: Start with just the logging. The index/enforcement can come in Phase 2.

## Deliverable
- Update `src/lib/manager.ts` to log `file_write` events to `.state/ops-receipts.jsonl`.
- Verify with a test case where Agent A writes a file, and we can query "Who wrote this?".
