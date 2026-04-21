# Your Context (auto-generated 2026-04-21T11:10)

**System:** 20 sessions/6h, 0% error rate

**Top spenders:**
- bob: 12s, 1168KB
- may: 4s, 157KB
- coach: 2s, 38KB
- tech-lead: 2s, 21KB

**📊 Your Metrics:**
- Coverage: **62** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
