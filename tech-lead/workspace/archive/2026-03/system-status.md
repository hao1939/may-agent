# System Status — Architecture & Known Constraints

**Last updated**: 2026-03-20T14:37Z
**Maintained by**: Tech-Lead

## Bob's Architecture Block Directive (2026-03-20)
All work on core system files (`manager.ts`, `chat-session.ts`, `manager-receipts.ts`, etc.) is **SUSPENDED** per `agents/bob/workspace/brief-architecture-block.md`. Bob verified the binary runtime finding and escalated to Human via `request-core-access.md`. Until source is mounted, focus exclusively on **Userland** improvements: Skills, Knowledge, Configs, Handlers.

## Runtime Architecture

The system runs from a **pre-built binary** (`pi-agent-core` npm package). Key facts:

1. **Source code is NOT visible to agents.** Files like `manager.ts`, `chat-session.ts`, `manager-receipts.ts`, `evaluator.ts` are compiled into the runtime. They are not mounted as readable files in the container.
2. **`src/` directory contains only agent-created files.** E.g., `src/lib/growth.ts` (created by tech-lead). This is NOT the full source tree.
3. **`node_modules/@mariozechner/pi-*` are dangling symlinks** pointing to `../../../pi-mono/` — a monorepo directory not volume-mounted in the container.
4. **Dev tools (npx, bun, tsc, vitest) are intermittently available.** Depends on container build/mount. When absent, all `Cannot find module` TSC errors are infrastructure noise, not code bugs.
5. **Agents cannot modify their own runtime.** This is architectural — prevents self-modification.

## Implications for Verification

- **White-box verification of infrastructure features is impossible** from inside agent containers
- Claims about runtime behavior (e.g., "OpBudget visibility is deployed") MUST be verified at runtime, not by reading source
- Runtime verification = observing actual tool output during a session, not reading code

## Feature Status (Runtime-Verified vs. Source-Only)

| Feature | Claimed Status | Runtime-Verified? | Notes |
|---------|---------------|-------------------|-------|
| `[SIG: ...]` receipts | Deployed | ✅ YES — visible in all tool output | Working |
| `<system_note>[COST: ...]</system_note>` | Deployed | ✅ YES — visible after bash calls | Working |
| `[Ops: X/Y]` budget visibility | Deployed | ✅ YES — confirmed `[Ops: 27/50]` visible 2026-03-20T14:37Z | Working! |
| Tool guards (read-dedup, finish-evidence, etc.) | Deployed (commit 94fbc27) | ⚠️ PARTIAL — some guards fire, untested systematically | |
| Dynamic Tool Listing (CS 4.5) | ⛔ SUSPENDED | ❌ Requires source access | Bob directive: deferred |
| Stuck session detection (3/5 error turns) | Deployed (common-sense.md) | ⚠️ Not independently verified | |
