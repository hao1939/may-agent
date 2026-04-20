# Your Context (auto-generated 2026-04-20T01:10)

**System:** 20 sessions/6h, 0% error rate

**Top spenders:**
- coach: 13s, 181KB
- optimizer: 3s, 99KB
- bob: 4s, 51KB

**📊 Your Metrics:**
- Coverage: **52** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
