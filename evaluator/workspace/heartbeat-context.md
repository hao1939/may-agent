# Your Context (auto-generated 2026-04-19T20:10)

**System:** 6 sessions/6h, 0% error rate

**Top spenders:**
- may: 1s, 137KB
- bob: 1s, 115KB
- coach: 2s, 29KB
- optimizer: 1s, 6KB
- amy: 1s, 5KB

**📊 Your Metrics:**
- Coverage: **71** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
