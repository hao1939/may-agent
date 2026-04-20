# Your Context (auto-generated 2026-04-20T06:10)

**System:** 18 sessions/6h, 0% error rate

**Top spenders:**
- optimizer: 3s, 186KB
- coach: 8s, 148KB
- scout: 1s, 125KB
- bob: 6s, 66KB

**📊 Your Metrics:**
- Coverage: **43** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
