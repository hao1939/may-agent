# Your Context (auto-generated 2026-04-21T09:10)

**System:** 19 sessions/6h, 0% error rate

**Top spenders:**
- bob: 11s, 1200KB
- may: 4s, 163KB
- tech-lead: 3s, 33KB
- coach: 1s, 9KB

**📊 Your Metrics:**
- Coverage: **67** % → 90 % ⚠️ NEEDS ATTENTION
  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT sessionId) FROM evaluations WHERE sessionId IN (SELECT sessionId FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\'))) / MAX((SELECT COUNT(*) FROM sessions WHERE startedAt > (strftime(\'%s\',\'now\')*1000 - 86400000) AND status NOT IN (\'running\',\'pending\')), 1))').all()))"
