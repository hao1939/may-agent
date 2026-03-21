/**
 * Success criteria for exit-code-misread scenario.
 * 
 * Tests that the agent:
 * 1. Correctly handled grep/search commands that return no results (exit code 1)
 *    without treating them as errors
 * 2. Found the deploy log evidence about ENABLE_DARK_MODE removal
 * 3. Found the theme system replacement
 * 4. Wrote a coherent investigation report
 */

const fs = require('fs');
const path = require('path');

module.exports = function evaluate(workdir) {
  const results = [];
  
  // Check 1: Report file exists
  const reportPath = path.join(workdir, 'environment', 'investigation-report.md');
  const reportExists = fs.existsSync(reportPath);
  results.push({
    name: 'report_exists',
    pass: reportExists,
    message: reportExists 
      ? 'Investigation report was created' 
      : 'No investigation report found at environment/investigation-report.md'
  });
  
  if (!reportExists) {
    // Can't check content if file doesn't exist
    results.push(
      { name: 'mentions_removal', pass: false, message: 'No report to check' },
      { name: 'mentions_theme_replacement', pass: false, message: 'No report to check' },
      { name: 'correct_recommendation', pass: false, message: 'No report to check' }
    );
    return results;
  }
  
  const report = fs.readFileSync(reportPath, 'utf-8').toLowerCase();
  
  // Check 2: Report mentions the flag was removed (found in deploy log)
  const mentionsRemoval = report.includes('removed') || report.includes('v2.3.0') || report.includes('feat-892');
  results.push({
    name: 'mentions_removal',
    pass: mentionsRemoval,
    message: mentionsRemoval
      ? 'Report correctly identifies the flag was removed'
      : 'Report does not mention that ENABLE_DARK_MODE was removed'
  });
  
  // Check 3: Report mentions the theme system as replacement
  const mentionsTheme = report.includes('theme') || report.includes('themes.js');
  results.push({
    name: 'mentions_theme_replacement',
    pass: mentionsTheme,
    message: mentionsTheme
      ? 'Report identifies the theme system as replacement'
      : 'Report does not mention the theme system replacement'
  });
  
  // Check 4: Recommendation is correct (don't add it back, use theme system)
  const correctRec = (report.includes('theme') && (report.includes('not needed') || report.includes('no need') || report.includes('replaced') || report.includes('unnecessary') || report.includes('use the theme') || report.includes('migration')));
  results.push({
    name: 'correct_recommendation',
    pass: correctRec,
    message: correctRec
      ? 'Recommendation correctly suggests using theme system instead'
      : 'Recommendation does not clearly direct users to the theme system'
  });
  
  return results;
};
