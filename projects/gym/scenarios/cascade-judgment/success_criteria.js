/**
 * Success Criteria for "cascade-judgment"
 *
 * The key insight: Incident #3 (OOM) is caused by the same root cause as
 * Incident #1 (broken eviction). A good agent recognizes this cascade:
 *   - Fix #1 → eviction works → cache doesn't grow unbounded → #3 is resolved
 *   - Fix #2 → search cache invalidated on rebuild → stale results gone
 *   - Fix #3 → should note it's a DUPLICATE of #1, not a separate issue
 *
 * The ops team's hypothesis for #3 (search index rebuild leak) is WRONG.
 * A good agent rejects the wrong hypothesis based on evidence.
 *
 * What we measure:
 * 1. Did the agent fix the eviction bug? (core fix)
 * 2. Did the agent fix search cache staleness? (separate fix)
 * 3. Did the agent recognize #3 is caused by #1? (cascade reasoning)
 * 4. Did the agent reject the "search index leak" hypothesis? (evidence-based)
 * 5. Did the agent write triage notes? (externalization)
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'cascade-judgment',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// CHECK 1: Tests still pass
check('tests-pass', () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('node test/cache.test.js', {
      cwd: path.resolve(envDir),
      encoding: 'utf8',
      timeout: 10000
    });
    const failMatch = output.match(/(\d+) failed/);
    const passMatch = output.match(/(\d+) passed/);
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    const p = passMatch ? parseInt(passMatch[1]) : 0;
    return { passed: f === 0 && p > 0, detail: `${p} passed, ${f} failed` };
  } catch (err) {
    return { passed: false, detail: `Tests errored: ${(err.stdout || err.message).substring(0, 200)}` };
  }
});

// CHECK 2: Eviction bug is fixed (core fix for #1 and #3)
check('eviction-fixed', () => {
  const cachePath = path.join(envDir, 'src', 'cache.js');
  if (!fs.existsSync(cachePath)) return { passed: false, detail: 'cache.js not found' };
  const code = fs.readFileSync(cachePath, 'utf8');
  
  // Extract the evictStale method body (from 'evictStale' to the next method or end of class)
  const evictMatch = code.match(/evictStale\s*\(\s*\)\s*\{([\s\S]*?)^\s{2}\}/m);
  if (!evictMatch) {
    // Maybe the method was rewritten or renamed — check if there's size-based eviction elsewhere
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hasSizeEviction = /\.size\s*>=?\s*(?:this\.)?maxSize/.test(stripped) && /\.delete\s*\(/.test(stripped);
    return { 
      passed: hasSizeEviction, 
      detail: hasSizeEviction 
        ? 'evictStale rewritten with size-based eviction'
        : 'evictStale method not found and no alternative eviction' 
    };
  }
  
  const evictBody = evictMatch[1];
  // Strip comments from just the evictStale body
  const stripped = evictBody
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');
  
  // In the UNFIXED code, the delete is commented out. After fix:
  const hasDelete = /this\.store\.delete\s*\(\s*key\s*\)/.test(stripped) || /\.delete\s*\(\s*key\s*\)/.test(stripped);
  const hasProperThreshold = /age\s*>=?\s*this\.ttl/.test(stripped);
  const hasSizeCheck = /\.size\s*>=?\s*(?:this\.)?maxSize/.test(stripped);
  
  // The evictStale must actually delete entries (not just have dead code)
  const evictionWorks = hasDelete && (hasProperThreshold || hasSizeCheck);
  
  return {
    passed: evictionWorks,
    detail: evictionWorks
      ? `Eviction fixed: delete=${hasDelete}, threshold=${hasProperThreshold}, sizeCheck=${hasSizeCheck}`
      : `Eviction still broken: delete=${hasDelete}, threshold=${hasProperThreshold}, sizeCheck=${hasSizeCheck}`
  };
});

// CHECK 3: Search staleness is addressed (fix for #2)
check('search-staleness-fixed', () => {
  const cachePath = path.join(envDir, 'src', 'cache.js');
  const searchPath = path.join(envDir, 'src', 'search.js');
  
  const cacheCode = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : '';
  const searchCode = fs.existsSync(searchPath) ? fs.readFileSync(searchPath, 'utf8') : '';
  
  // Strip comments AND string literals to avoid false positives from log messages
  function stripNonCode(code) {
    return code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``');
  }
  
  const cacheStripped = stripNonCode(cacheCode);
  const searchStripped = stripNonCode(searchCode);
  
  // Fix options:
  // a) Reduce search cache TTL 
  // b) Invalidate search cache entries on rebuildIndex()
  // c) Add a search-specific TTL that's shorter
  // d) Call clear() or delete search entries in rebuildIndex
  
  // Check if the CACHE_TTL_MS was changed from 24h to something shorter
  const ttlMatch = cacheStripped.match(/CACHE_TTL_MS\s*=\s*([^;]+)/);
  let ttlChanged = false;
  if (ttlMatch) {
    const expr = ttlMatch[1].trim();
    // Original is 24 * 60 * 60 * 1000. If it's now different (smaller), that counts.
    ttlChanged = !expr.includes('24');
  }
  
  // Check if a separate search TTL was added
  const searchTTLAdded = /search.*ttl|SEARCH_TTL|search_cache_ttl/i.test(cacheStripped) ||
    /new Cache.*ttl/i.test(searchStripped);
  
  // Check if rebuildIndex now invalidates cache (code change, not just strings)
  const rebuildMatch = searchStripped.match(/rebuildIndex\s*\(\s*\)\s*\{([\s\S]*?)^\}/m);
  let rebuildInvalidates = false;
  if (rebuildMatch) {
    const body = rebuildMatch[1];
    rebuildInvalidates = body.includes('.clear') || 
      body.includes('.delete') ||
      body.includes('invalidate') ||
      body.includes('flush');
  }
  
  const fixed = ttlChanged || searchTTLAdded || rebuildInvalidates;
  
  return {
    passed: fixed,
    detail: fixed
      ? `Search staleness addressed: ttlChanged=${ttlChanged}, searchTTL=${searchTTLAdded}, rebuildInvalidates=${rebuildInvalidates}`
      : 'Search cache staleness not addressed — cached results still serve for 24h'
  };
});

// CHECK 4: TRIAGE.md exists with substantive notes
check('triage-exists', () => {
  let triagePath = path.join(envDir, 'TRIAGE.md');
  if (!fs.existsSync(triagePath)) {
    triagePath = path.join(envDir, 'triage.md');
  }
  if (!fs.existsSync(triagePath)) {
    return { passed: false, detail: 'No TRIAGE.md — agent did not document reasoning' };
  }
  const content = fs.readFileSync(triagePath, 'utf8');
  
  // Should mention all 3 incidents
  const mentionsAll = /incident.?1|#1/i.test(content) && 
    /incident.?2|#2/i.test(content) && 
    /incident.?3|#3/i.test(content);
  
  return {
    passed: content.length > 200 && mentionsAll,
    detail: content.length > 200 && mentionsAll
      ? `TRIAGE.md exists (${content.length} chars), mentions all 3 incidents`
      : `TRIAGE.md ${content.length > 200 ? 'exists' : 'too brief'}, mentionsAll=${mentionsAll}`
  };
});

// CHECK 5: Agent recognizes #3 is caused by #1 (CASCADE REASONING)
check('cascade-recognized', () => {
  let triagePath = path.join(envDir, 'TRIAGE.md');
  if (!fs.existsSync(triagePath)) triagePath = path.join(envDir, 'triage.md');
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'No TRIAGE.md' };
  
  const content = fs.readFileSync(triagePath, 'utf8').toLowerCase();
  
  // The triage should note that #3 is related to / caused by / duplicate of #1
  const cascadeTerms = [
    /(?:incident|#)\s*3.*(?:same|relat|caus|duplic|resolv|fix).*(?:incident|#)\s*1/,
    /(?:incident|#)\s*1.*(?:fix|resolv).*(?:incident|#)\s*3/,
    /oom.*(?:caus|relat|same).*(?:evict|cache)/,
    /(?:cache|evict).*(?:caus|relat|same).*oom/,
    /(?:both|same).*root.*cause/,
    /fixing.*(?:evict|#1).*(?:resolv|fix).*(?:oom|#3|memory)/,
    /#3.*not.*separate|#3.*duplicate|#3.*already.*fixed/
  ];
  
  const matches = cascadeTerms.filter(term => term.test(content));
  
  return {
    passed: matches.length >= 1,
    detail: matches.length >= 1
      ? `Cascade recognized: agent identified #3 is related to #1 (${matches.length} patterns matched)`
      : 'No cascade recognition — agent treated #3 as independent from #1'
  };
});

// CHECK 6: Agent rejects the wrong hypothesis ("search index rebuild leak")
check('wrong-hypothesis-rejected', () => {
  let triagePath = path.join(envDir, 'TRIAGE.md');
  if (!fs.existsSync(triagePath)) triagePath = path.join(envDir, 'triage.md');
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'No TRIAGE.md' };
  
  const content = fs.readFileSync(triagePath, 'utf8').toLowerCase();
  
  // Should mention that the search index rebuild is NOT the cause
  const rejectsWrongHypothesis = 
    /(?:not|isn't|isn't|doesn't|does not).*(?:search.?index|rebuild).*leak/i.test(content) ||
    /(?:search.?index|rebuild).*(?:not|isn't).*(?:cause|leak|issue)/i.test(content) ||
    /cache.*(?:actual|real|true).*cause/i.test(content) ||
    /ops.*(?:wrong|incorrect|mistaken)/i.test(content) ||
    content.includes('not the search index') ||
    content.includes('not caused by the search') ||
    content.includes('not a leak in the search') ||
    (content.includes('cache') && content.includes('not') && content.includes('search index'));
  
  return {
    passed: rejectsWrongHypothesis,
    detail: rejectsWrongHypothesis
      ? 'Correctly rejected ops team\'s "search index leak" hypothesis'
      : 'Did not explicitly reject the wrong hypothesis about search index rebuild'
  };
});

// SCORING
const testsPass = results.checks[0]?.passed ?? false;
const evictionFixed = results.checks[1]?.passed ?? false;
const stalenessFixed = results.checks[2]?.passed ?? false;
const triageExists = results.checks[3]?.passed ?? false;
const cascadeRecognized = results.checks[4]?.passed ?? false;
const hypothesisRejected = results.checks[5]?.passed ?? false;

const totalPassed = results.checks.filter(c => c.passed).length;

// Core requirement: tests pass + eviction fixed + triage exists
// Bonus: cascade recognized + hypothesis rejected + staleness fixed
const coresMet = testsPass && evictionFixed && triageExists;

results.passed = coresMet && totalPassed >= 4;

if (totalPassed === 6) {
  results.summary = 'EXCELLENT: All 3 incidents correctly triaged, cascade recognized, wrong hypothesis rejected';
} else if (coresMet && cascadeRecognized) {
  results.summary = `GOOD: Core fixes applied, cascade recognized (${totalPassed}/6)`;
} else if (coresMet) {
  results.summary = `ADEQUATE: Core fixes applied but treated incidents independently (${totalPassed}/6)`;
} else if (evictionFixed) {
  results.summary = `PARTIAL: Eviction fixed but ${!triageExists ? 'no triage notes' : 'tests failing'} (${totalPassed}/6)`;
} else {
  results.summary = `INCOMPLETE: ${totalPassed}/6 checks passed — core eviction bug not fixed`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
