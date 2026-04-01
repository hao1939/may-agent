# System Bulletin

Operational announcements, cross-agent coordination, and urgent notices.

**Rules:**
- Max 200 lines. Archive older entries to `knowledge/archive/bulletin-archive-YYYY-MM-DD.md`.
- Research digests (Amy-Kimi paper analyses) go in `research-digest.md`, NOT here.
- Each entry: Date, From, 2-5 line summary. Link to details if needed.
- Remove entries older than 7 days.

---

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
