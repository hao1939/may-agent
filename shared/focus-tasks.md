# Focus Tasks

**Status: Active**
**Owner: Bob**

This file tracks the immediate, high-leverage tasks that the team is focusing on.
It bridges the gap between the high-level `roadmap.md` and individual `todo.md` lists.

## Active Focus

### Memory Consolidation Design (Architecture) (2026-03-12)
- **Context**: Scout's research identified a missing "Manage" phase in our memory loop. Agents write to `workspace/` and read `knowledge/`, but nothing systematically moves insight from A to B.
- **Goal**: Design a standard workflow/cron for agents to consolidate ephemeral journals into permanent knowledge.
- **Owner**: Bob
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Implemented `agents/shared/tasks/consolidate-memory.md` task.
  - Added weekly cron jobs for Bob, Scout, Coach, Optimizer, Amy.
  - Verified manual run for Bob (journal archived, insights extracted).
  - This closes the "Write-Manage-Read" loop for key agents.


## Archive (Completed)

### System Prompt Implementation (Architecture) (2026-03-12)
- **Context**: V2 System Prompt design (`docs/architecture/system-prompt.md`) approved. Reduces prompt size by ~60% and decouples agents from shared files.
- **Owner**: Tech-Lead
- **Status**: **COMPLETED** (2026-03-12)
- **Outcome**:
  - Bob created `knowledge/INDEX.md` for all 12 agents.
  - Tech-Lead verified `manager.ts` and `agent-loader.ts` already implement the 7-section convention-based assembly.
  - Deprecated `skills`, `systemPromptFiles`, and `projectStructure` logic in `src/lib/`.
  - All 907 tests pass. Prompt size reduced significantly.

### Investigate Driver Stability (Operations) (2026-03-12)
- **Context**: The `focus-task-driver` session is frequently interrupted/timed-out. We need to optimize the driver loop or adjust timeouts to ensure reliability.
- **Owner**: May
- **Status**: **INVESTIGATED** (2026-03-12)
- **Findings**:
  - Analyzed 55 focus-task-driver sessions. ~80% complete successfully, ~20% fail.
  - Bimodal pattern: most complete in 6-47s (no actionable tasks → quick exit), longer ones run 90-600s.
  - Failure modes: (1) "Request was aborted" — system restart/watchdog kills session, (2) ENOENT — session dir cleaned up during execution (possible race condition in cleanup).
  - The scope guardrails added to the cron message are working (latest session completed normally).
  - Root causes are transient (system restarts, LLM streaming truncation) — not a driver-specific bug.
- **Recommendation**: Mark as low-priority. The 20% failure rate is acceptable for a background polling task — it retries hourly. The ENOENT race condition could be investigated but is rare.
- **Outcome**: No systemic driver bug found. Failures are infrastructure-level transients.

### Verify Scout V2 (Research) (2026-03-12)
- **Verification**: Assigned deep research task ("Agent Memory Patterns 2026").
- **Result**: Scout produced `agents/scout/workspace/agent-memory-persistence-research.md`.
- **Quality**: Excellent adherence to V2 standards (Brief + Detail, Source Hierarchy, Citation).
- **Outcome**: Confirmed V2 upgrade is successful.

### Agent Growth Cycle (Meta-Loop) (2026-03-12)
- **Scout V2 Upgrade**: Successfully used `agent-growth` tools to fork, upgrade, verify, and promote Scout.
- **Method**: Coach agent executed the plan in `agents/coach/workspace/tasks/upgrade-scout.md`.
- **Result**: Scout now has "Research Standards", "Source Hierarchy", and strict "Brief + Detail" output format.

### V2 Migration & Hardening (2026-03-11)
- **Coach Tools Verified**: Confirmed `fork_agent`/`promote_agent` are available to Coach agent.
- **Agent-Specific Evaluation**: Implemented role-specific criteria in `SOUL.md`.
- **V2 Documentation Alignment**: Aligned `system-design.md` and `team.md`.
- **Agent Growth Tools**: Implemented `fork`, `promote`, `discard` tools.
- **Hard-Gated Coder**: Implemented `verified-coder` workflow.
- **Crash Recovery State**: Implemented `[STARTED]` sentinel files.
- **V2 Design Finalization**: Design frozen.
- **Robust Scraping**: Implemented `scrape_webpage`.
- **V2 Implementation**: System fully migrated to ephemeral sessions.
