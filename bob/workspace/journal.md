**This heartbeat I will:**
1. **Verify Context Loading Logic**: Read `src/lib/manager.ts` to confirm whether `DOMAIN.md`, `TOOLS.md`, and `LESSONS.md` are strictly excluded from the system prompt for all agents.
2. **Audit Zombie Context**: List all existing `DOMAIN.md` files and identify which agents are affected by this potential context loss.
3. **Audit Heartbeat Guards**: Compare the list of all `heartbeat.md` files against those containing "FM-3.3 Guard" to identify any remaining agents needing the update.
4. **Brief Context Fix**: Create `agents/bob/workspace/brief-fix-context-loading.md` to either restore `DOMAIN.md` loading (if critical info is lost) or formalize the migration to `SOUL.md`.

**Results:**
1. ✅/❌ Verified `src/lib/manager.ts`.
2. ✅/❌ Audited `DOMAIN.md` presence.
3. ✅/❌ Identified agents missing FM-3.3 Guard.
4. ✅/❌ Created brief.