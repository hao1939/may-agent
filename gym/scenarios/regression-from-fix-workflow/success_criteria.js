import { Score } from '../gym-score-utils.js';

/**
 * Regression-from-fix-workflow scenario scorer.
 * 
 * Same checks as the base scenario, PLUS analysis quality check.
 * The workflow forces Phase 1 (analyze all code + dependencies) before Phase 2 (fix + verify).
 * 
 * The bug: In billing.js, the discount lookup uses undefined variable `code`
 * instead of `discountCode`. The fix is simple: change `code` to `discountCode`.
 * 
 * What we check:
 * 1. The agent read billing.js before editing
 * 2. The discount bug is actually fixed
 * 3. The agent ran the test suite
 * 4. Tax-exempt functionality still works (no regression)
 * 5. The fix is minimal (used edit() not write())
 * 6. All tests pass
 * 7. Analysis quality (analysis.md exists and shows regression awareness)
 */
export default async function score(sessionLog) {
  const s = new Score(sessionLog);
  const checks = [];
  
  // Check 1: Agent read the source file before editing
  const readBilling = s.toolCalls.some(c => 
    c.name === 'read' && c.arguments?.path?.includes('billing.js')
  );
  checks.push({
    name: 'read-before-edit',
    pass: readBilling,
    message: readBilling 
      ? 'Agent read billing.js before editing' 
      : 'Agent did not read billing.js before editing'
  });
  
  // Check 2: Agent fixed the bug (changed `code` to `discountCode`)
  const editCalls = s.toolCalls.filter(c => 
    (c.name === 'edit' || c.name === 'write') && 
    c.arguments?.path?.includes('billing.js')
  );
  const fixApplied = editCalls.some(c => {
    const content = c.arguments?.newText || c.arguments?.content || '';
    return content.includes('DISCOUNT_CODES[discountCode]') || 
           content.includes('DISCOUNT_CODES[ discountCode ]');
  });
  checks.push({
    name: 'discount-bug-fixed',
    pass: fixApplied,
    message: fixApplied 
      ? 'Agent fixed the discount code variable reference' 
      : 'Agent did not fix the core bug (code → discountCode)'
  });
  
  // Check 3: Agent ran the test suite
  const ranTests = s.toolCalls.some(c =>
    c.name === 'bash' && c.arguments?.command?.includes('test-billing')
  );
  checks.push({
    name: 'ran-tests',
    pass: ranTests,
    message: ranTests 
      ? 'Agent ran the test suite' 
      : 'Agent did not run the test suite'
  });
  
  // Check 4: Tax-exempt function not broken (no edits to calculateTaxExemptTotal)
  const taxExemptBroken = editCalls.some(c => {
    const content = c.arguments?.newText || c.arguments?.content || '';
    if (c.name === 'write' && content.includes('calculateTaxExemptTotal')) {
      return !content.includes('result.taxable') || !content.includes('tax: 0');
    }
    if (c.name === 'edit') {
      const oldText = c.arguments?.oldText || '';
      return oldText.includes('calculateTaxExemptTotal') || 
             oldText.includes('taxExempt');
    }
    return false;
  });
  checks.push({
    name: 'tax-exempt-preserved',
    pass: !taxExemptBroken,
    message: taxExemptBroken 
      ? 'Agent broke or modified the tax-exempt function (regression!)' 
      : 'Tax-exempt function preserved correctly'
  });
  
  // Check 5: Minimal fix — agent used edit() not write() to rewrite entire file
  const usedMinimalEdit = editCalls.some(c => c.name === 'edit');
  const rewroteFile = editCalls.some(c => c.name === 'write');
  checks.push({
    name: 'minimal-fix',
    pass: usedMinimalEdit && !rewroteFile,
    message: usedMinimalEdit && !rewroteFile
      ? 'Agent used surgical edit (not full rewrite)'
      : rewroteFile
        ? 'Agent rewrote the entire file instead of making a targeted edit'
        : 'Agent did not make any edits to billing.js'
  });
  
  // Check 6: All tests pass (agent saw green test output)
  const testOutput = s.toolCalls
    .filter(c => c.name === 'bash' && c.arguments?.command?.includes('test-billing'))
    .map(c => s.getToolResult(c))
    .join('\n');
  const allTestsPass = testOutput.includes('0 failed') || 
                       (testOutput.includes('passed') && !testOutput.includes('✗'));
  checks.push({
    name: 'all-tests-pass',
    pass: allTestsPass,
    message: allTestsPass 
      ? 'All tests passed after fix' 
      : 'Some tests still failing after fix'
  });

  // Check 7 (Workflow bonus): analysis.md shows regression awareness
  const analysisWrite = s.toolCalls.find(c =>
    c.name === 'write' && c.arguments?.path?.includes('analysis.md')
  );
  let analysisQuality = false;
  if (analysisWrite) {
    const content = (analysisWrite.arguments?.content || '').toLowerCase();
    const mentionsDependents = content.includes('calculatetaxexempttotal') || 
                                content.includes('tax-exempt') ||
                                content.includes('tax exempt') ||
                                content.includes('generateinvoice') ||
                                content.includes('generate invoice') ||
                                content.includes('dependent') ||
                                content.includes('relies on') ||
                                content.includes('calls calculatetotal');
    const identifiesBug = content.includes('code') && content.includes('discountcode');
    analysisQuality = mentionsDependents && identifiesBug;
  }
  checks.push({
    name: 'analysis-quality',
    pass: analysisQuality,
    message: analysisQuality
      ? 'analysis.md identifies bug AND documents dependent functions (regression awareness)'
      : analysisWrite
        ? 'analysis.md exists but missing regression awareness or bug identification'
        : 'No analysis.md written — agent skipped the analysis phase'
  });
  
  return checks;
}
