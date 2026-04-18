/**
 * Success Criteria for "tangled-inventory"
 *
 * Tests a three-bug entangled scenario:
 *   Bug 1 (scorer.js): Curve applies to wrong group (>= avg instead of < avg)
 *   Bug 2 (grader.js): Grade boundary uses > instead of >=
 *   Bug 3 (report.js): Honors filter uses || instead of &&
 *
 * Bug interactions:
 *   - Bug 1 changes every student's score, masking Bug 2
 *   - Bug 2 only manifests after Bug 1 is fixed (boundary cases at 90.00 and 80.00)
 *   - Bug 3 inflates honors list; its effect changes depending on Bug 2's grade assignments
 *
 * Scoring:
 *   40% — All tests pass (node test/test.js exits 0)
 *   20% — Bug 1 fixed correctly (curve direction)
 *   20% — Bug 2 fixed correctly (grade boundary)
 *   20% — Bug 3 fixed correctly (honors filter)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workDir = process.argv[2];
if (!workDir) {
  console.error('Usage: node success_criteria.js <workDir>');
  process.exit(1);
}

async function evaluate(workDir) {
  const results = {
    score: 0,
    maxScore: 100,
    tests_pass: false,
    bugs_fixed: { curve_direction: false, grade_boundary: false, honors_filter: false },
    details: []
  };

  // The gym runner copies environment/ contents directly into workDir
  const envDir = workDir;

  // Check 1: Do all tests pass?
  try {
    const output = execSync('node test/test.js', {
      cwd: envDir,
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const match = output.match(/(\d+) passed, (\d+) failed/);
    if (match && parseInt(match[2]) === 0) {
      results.tests_pass = true;
      results.score += 40;
      results.details.push('All tests pass (+40)');
    } else {
      const failCount = match ? match[2] : '?';
      results.details.push(`Tests still failing: ${failCount} failures`);
    }
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    const output = stdout + stderr;
    const match = output.match(/(\d+) passed, (\d+) failed/);
    if (match) {
      results.details.push(`Tests: ${match[1]} passed, ${match[2]} failed`);
    } else {
      results.details.push(`Test run error: ${output.slice(0, 200)}`);
    }
  }

  // Check 2: Bug 1 — Curve direction in scorer.js
  try {
    const scorerSrc = fs.readFileSync(
      path.join(envDir, 'src', 'scorer.js'), 'utf8'
    );
    // The fix: change >= to < (or equivalent) in the curve condition
    // The buggy line: if (s.weighted_score >= avg)
    // The fixed line: if (s.weighted_score < avg)
    // We check that the curve boost is applied to below-average students
    const hasBuggyPattern = /weighted_score\s*>=\s*avg/.test(scorerSrc);
    const hasCorrectPattern = /weighted_score\s*<\s*avg/.test(scorerSrc);
    
    if (!hasBuggyPattern && hasCorrectPattern) {
      results.bugs_fixed.curve_direction = true;
      results.score += 20;
      results.details.push('Bug 1 fixed: curve applied to below-average students (+20)');
    } else if (hasBuggyPattern) {
      results.details.push('Bug 1 NOT fixed: curve still applies to >= avg');
    } else {
      // Check if the logic is functionally correct even if rewritten
      // Run a targeted check
      try {
        const checkOutput = execSync(`node -e "
          const { computeWeightedScores, applyCurve } = require('./src/scorer');
          const policy = require('./data/policy.json');
          const { loadStudents } = require('./src/loader');
          const students = loadStudents('./data/students.csv', policy);
          const scored = computeWeightedScores(students, policy);
          const curved = applyCurve(scored, policy);
          const s001 = curved.find(s => s.student_id === 'S001');
          const s002 = curved.find(s => s.student_id === 'S002');
          console.log(JSON.stringify({s001_curved: s001.curved, s002_curved: s002.curved, s001_score: s001.weighted_score}));
        "`, { cwd: envDir, timeout: 5000, encoding: 'utf8' });
        
        const check = JSON.parse(checkOutput.trim());
        if (!check.s001_curved && check.s002_curved && check.s001_score === 90) {
          results.bugs_fixed.curve_direction = true;
          results.score += 20;
          results.details.push('Bug 1 fixed: curve direction correct (verified by behavior) (+20)');
        } else {
          results.details.push(`Bug 1 unclear: S001 curved=${check.s001_curved}, S002 curved=${check.s002_curved}`);
        }
      } catch (e2) {
        results.details.push('Bug 1: could not verify (scorer.js may have errors)');
      }
    }
  } catch (e) {
    results.details.push('Bug 1: could not read scorer.js');
  }

  // Check 3: Bug 2 — Grade boundary in grader.js
  try {
    const graderSrc = fs.readFileSync(
      path.join(envDir, 'src', 'grader.js'), 'utf8'
    );
    // The fix: change > to >= in the grade boundary check
    const hasBuggyPattern = /weighted_score\s*>\s*minScore/.test(graderSrc) && 
                            !/weighted_score\s*>=\s*minScore/.test(graderSrc);
    const hasCorrectPattern = /weighted_score\s*>=\s*minScore/.test(graderSrc);
    
    if (hasCorrectPattern && !hasBuggyPattern) {
      results.bugs_fixed.grade_boundary = true;
      results.score += 20;
      results.details.push('Bug 2 fixed: grade boundary uses >= (+20)');
    } else if (hasBuggyPattern) {
      results.details.push('Bug 2 NOT fixed: grade boundary still uses >');
    } else {
      // Behavioral check
      try {
        const checkOutput = execSync(`node -e "
          const { assignGrades } = require('./src/grader');
          const policy = require('./data/policy.json');
          // Test with score exactly on A- boundary (90)
          const result = assignGrades([{student_id:'TEST', weighted_score:90, curved:false}], policy);
          console.log(result[0].letter_grade);
        "`, { cwd: envDir, timeout: 5000, encoding: 'utf8' });
        
        if (checkOutput.trim() === 'A-') {
          results.bugs_fixed.grade_boundary = true;
          results.score += 20;
          results.details.push('Bug 2 fixed: boundary score 90 → A- (verified by behavior) (+20)');
        } else {
          results.details.push(`Bug 2 NOT fixed: boundary score 90 → ${checkOutput.trim()} (expected A-)`);
        }
      } catch (e2) {
        results.details.push('Bug 2: could not verify (grader.js may have errors)');
      }
    }
  } catch (e) {
    results.details.push('Bug 2: could not read grader.js');
  }

  // Check 4: Bug 3 — Honors filter in report.js
  try {
    const reportSrc = fs.readFileSync(
      path.join(envDir, 'src', 'report.js'), 'utf8'
    );
    // The fix: change || to && in the honors filter
    // Look for the honors filtering logic
    const hasBuggyOr = /min_score\s*\|\|/.test(reportSrc) || 
                       /min_gpa.*\|\|/.test(reportSrc) ||
                       /honors.*\|\|/s.test(reportSrc);
    const hasCorrectAnd = /min_score\s*&&/.test(reportSrc) ||
                          /min_gpa.*&&/.test(reportSrc);

    // More precise: look for the filter line
    const filterLine = reportSrc.match(/\.filter\(.*(?:honors|min_score|min_gpa).*\)/s);
    
    if (filterLine) {
      const hasOr = /\|\|/.test(filterLine[0]);
      const hasAnd = /&&/.test(filterLine[0]);
      
      if (hasAnd && !hasOr) {
        results.bugs_fixed.honors_filter = true;
        results.score += 20;
        results.details.push('Bug 3 fixed: honors filter uses && (+20)');
      } else if (hasOr) {
        results.details.push('Bug 3 NOT fixed: honors filter still uses ||');
      }
    } else {
      // Behavioral check
      try {
        const checkOutput = execSync(`node -e "
          const { generateReport } = require('./src/report');
          const policy = require('./data/policy.json');
          // Student with score=88 (>=85) but gpa=3.3 (<3.5) should NOT be honors
          const students = [
            {student_id:'H1',name:'Test',weighted_score:95,letter_grade:'A',gpa:4,curved:false},
            {student_id:'H2',name:'Test2',weighted_score:88,letter_grade:'B+',gpa:3.3,curved:false}
          ];
          const report = generateReport(students, policy, '/dev/null');
          console.log(report.honors_list.length);
        "`, { cwd: envDir, timeout: 5000, encoding: 'utf8' });
        
        if (checkOutput.trim() === '1') {
          results.bugs_fixed.honors_filter = true;
          results.score += 20;
          results.details.push('Bug 3 fixed: honors filter correctly excludes high-score/low-gpa student (+20)');
        } else {
          results.details.push(`Bug 3 NOT fixed: honors includes ${checkOutput.trim()} students (expected 1)`);
        }
      } catch (e2) {
        results.details.push('Bug 3: could not verify (report.js may have errors)');
      }
    }
  } catch (e) {
    results.details.push('Bug 3: could not read report.js');
  }

  return results;
}

// CLI entry point
evaluate(workDir).then(results => {
  // Convert to checks format expected by gym runner
  const checks = [];
  if (results.tests_pass) {
    checks.push({ name: 'all-tests-pass', passed: true, detail: 'All 37 tests pass' });
  }
  for (const [bug, fixed] of Object.entries(results.bugs_fixed)) {
    checks.push({ name: bug, passed: fixed, detail: `${bug}: ${fixed ? 'fixed' : 'not fixed'}` });
  }
  
  const output = {
    passed: results.score === results.maxScore,
    score: results.score,
    maxScore: results.maxScore,
    checks,
    summary: results.details.join('; '),
    details: results.details
  };
  console.log(JSON.stringify(output));
  process.exit(output.passed ? 0 : 1);
}).catch(err => {
  console.log(JSON.stringify({ passed: false, checks: [], summary: `scoring error: ${err.message}` }));
  process.exit(1);
});
