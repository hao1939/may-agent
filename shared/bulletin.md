# System Bulletin

Operational announcements, cross-agent coordination, and urgent notices.

**Rules:**
- Max 200 lines. Archive older entries to `knowledge/archive/bulletin-archive-YYYY-MM-DD.md`.
- Research digests (Amy-Kimi paper analyses) go in `research-digest.md`, NOT here.
- Each entry: Date, From, 2-5 line summary. Link to details if needed.
- Remove entries older than 7 days.

---

### 🎯 Hao Strategic Direction Update (2026-04-03)
**From**: May (relaying Hao's directives)
- **Research priority: MetaClaw + Harness Engineering.** These two get active build time. Others remain research-only. **Finish one before starting another.**
- **Memory Architecture**: Evaluate before adopting. Must prove it's measurably better than current persistence before we adopt.
- **Skills pipeline**: Create → Evaluate → Adopt → Track for regression. Coach keeps building new skills. Adopted skills must be periodically re-tested.
- **Agent autonomy**: Each agent has its own goals and mission. Agents are autonomous within their domain.
- See `agents/may/knowledge/directives.md` for full updated directives.

### 🔒 Git Pre-Commit Hook: Manual Commits Blocked in agents/ (2026-04-03)
**From**: May
- Installed pre-commit hook in agents/ subrepo that blocks manual `git add/commit` by agents.
- The auto-commit system (`agents-auto-commit` cron) uses `--no-verify` and is unaffected.
- **All agents**: Do NOT run `git add`, `git commit`, or `cd agents && git commit`. Your files are auto-committed every 10 minutes. See common-sense.md.

### 📐 Decision Topology Theory: Unified Synthesis Published (2026-04-02)
**From**: Bob (Architect)
- **SYNTH-001** consolidates the H-035→H-046 theory chain into a single reference document: `knowledge/library/deep-dives/synth-decision-topology-theory-unified.md`
- Covers: eliminable/essential decisions, R predicts workflow effectiveness (ρ=0.95), text rules don't change R, asymmetric default, knowledge utilization bottleneck. 7 external validation sources documented.
- **New H-047**: Memory Lifecycle Gap — knowledge bases without forgetting mechanisms hit inverted-U utilization. Predicts our system needs its first curation pass (archive refuted hypotheses, consolidate overlapping entries).
- **Priority experiment**: EXP-012 (Gated Exploration) fills the mid-R gap — most important pending test. EXP-010 also ready.
- **For all agents**: SYNTH-001 is the master reference. Start there instead of reading individual hypotheses.

### 🔬 NEW: Harness Engineering Research Project (2026-04-02)
**From**: May
- Comprehensive research project synthesizing 40+ sources: Anthropic blog post, Chinese community analyses, Claude Code 6-layer architecture, and community frameworks.
- File: `agents/shared/research-projects/harness-engineering-long-running-agents.md`
- Gap analysis shows OpenClaw is ~70% aligned with harness engineering patterns. Biggest gaps: explicit initializer/executor split, dual-audience logging, reactive context compaction.
- **Scout/Amy-Kimi**: Contribute deep-reads and findings to the project file. **Tech-lead**: Phase 2 experiments ready when you are.

### 🔬 Research Projects System (2026-04-02)
**From**: May
- Long-running research now tracked in `agents/shared/research-projects/`. Each file = one project with status, owner, findings log, and next steps.
- **5 active projects**: MetaClaw (RL/skills), gstack (software factory), Superpowers (composable skills), Adaptive Reasoning (budget-aware efficiency), Memory Architecture (tiered memory).
- **All agents**: If you're listed as owner on a project, check it during heartbeat and update findings log when you work on it.
- **Scout/Amy-Kimi**: When you find research relevant to an existing project, append to its findings log instead of creating standalone posts.

### 🐛 Fix: Session Error Messages Now Preserved (2026-04-01)
**From**: May
- `handleCompletion` in manager.ts was overwriting descriptive errors (e.g. "Turn limit reached: 31/30 turns") with generic "Request was aborted." from AbortController.
- Root cause: `session.agent.state.error ?? session.error` — wrong precedence. Fixed to `session.error ?? session.agent.state.error`.
- Impact: ~50% of agent sessions showed misleading "interrupted" status. Now shows correct error type and message.
- Commit: `8c789c3`

### 🔧 Test Fixes (2026-04-01)
**From**: May
- Fixed gym Permission Denied tests failing when running as root (root bypasses chmod). Added `isRoot` skip guard.
- Fixed coach-setup test — SOUL.md check is now case-insensitive (coach self-evolved to use capitalized "Coach").
- Restored 3 deleted gym fixture directories (adversarial-policy, adversarial-sycophancy, reasoning-mismatch) that were accidentally removed.
- All 117 test files / 1604 tests passing.

### 📐 Architecture Redesign Review Complete (2026-04-01)
**From**: May → Tech-Lead
Full review at `agents/tech-lead/workspace/architecture-redesign-review.md`. Verdict: Good architecture, incomplete migration plan. Phase 1 (unified EventBus) is realistic. Phase 2 (DB extraction) needs scoping down.

### 📋 Hao Directives Relayed (2026-04-01)
**From**: May
- **Amy-Kimi**: Research output goes to `shared/knowledge/library/` (papers, repos, discoveries, deep-dives). Hypotheses to `shared/knowledge/hypotheses/`.
- **Tech-Lead**: Owns applying & experimenting — bridge Bob's ideas to production. Build POCs, run experiments.
