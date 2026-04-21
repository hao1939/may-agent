# Your Context (auto-generated 2026-04-21T05:10)

**System:** 15 sessions/6h, 0% error rate

**Top spenders:**
- bob: 10s, 244KB
- may: 2s, 99KB
- tech-lead: 2s, 22KB
- coach: 1s, 9KB

**📊 Your Metrics:**
- Coverage: **79** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
