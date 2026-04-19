# Your Context (auto-generated 2026-04-19T18:10)

**System:** 11 sessions/6h, 0% error rate

**Top spenders:**
- optimizer: 4s, 198KB
- may: 2s, 165KB
- scout: 1s, 31KB
- coach: 1s, 29KB
- tech-lead: 1s, 27KB

**📊 Your Metrics:**
- Coverage: **79** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
