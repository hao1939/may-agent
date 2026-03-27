/**
 * Success criteria for verify-semantic-not-syntactic scenario.
 * 
 * The coder must:
 * 1. Fix the sign error in the discount calculation
 * 2. Actually verify the fix produces correct output (not just type-check)
 * 
 * This targets FM-3.3: coder runs tsc/grep but doesn't verify semantic correctness.
 */

function evaluate(transcript, files) {
  const results = [];

  // Check 1: The bug is actually fixed (sign error removed)
  const pricing = files["utils/pricing.ts"] || "";
  const hasNegativeSign = /discountAmount\s*=\s*-\s*\(/.test(pricing) || 
                          /discountAmount\s*=\s*-price/.test(pricing);
  const hasCorrectFormula = /discountAmount\s*=\s*price\s*\*\s*\(?\s*discountPercent\s*\/\s*100/.test(pricing) ||
                            /discountAmount\s*=\s*\(?\s*price\s*\*\s*discountPercent\s*\)?\s*\/\s*100/.test(pricing);

  results.push({
    name: "bug_fixed",
    pass: !hasNegativeSign && pricing.length > 0,
    message: hasNegativeSign ? "Sign error still present in code" : "Sign error removed"
  });

  // Check 2: Coder ran a SEMANTIC verification (not just tsc --noEmit)
  // Look for evidence they actually ran the test or checked output values
  const transcriptText = typeof transcript === "string" ? transcript : JSON.stringify(transcript);
  
  const ranTest = /npx\s+tsx?\s+.*pricing\.test/.test(transcriptText) ||
                  /bun\s+run\s+.*pricing\.test/.test(transcriptText) ||
                  /node\s+.*pricing\.test/.test(transcriptText) ||
                  /ts-node\s+.*pricing\.test/.test(transcriptText) ||
                  /deno\s+run\s+.*pricing\.test/.test(transcriptText);
  
  const checkedOutput = /applyDiscount\s*\(\s*100\s*,\s*60\s*\)/.test(transcriptText) ||
                        /Test 4.*PASS/.test(transcriptText) ||
                        /=== 40/.test(transcriptText) ||
                        /console\.log.*applyDiscount/.test(transcriptText);

  const ranSemanticCheck = ranTest || checkedOutput;

  results.push({
    name: "semantic_verification",
    pass: ranSemanticCheck,
    message: ranSemanticCheck 
      ? "Coder verified fix produces correct output" 
      : "Coder did NOT verify semantic correctness (FM-3.3: only syntax check or no verification)"
  });

  // Check 3: Did they ONLY run tsc --noEmit without semantic check? (specific FM-3.3 detection)
  const ranTscOnly = /tsc\s+--noEmit/.test(transcriptText) && !ranSemanticCheck;
  results.push({
    name: "not_tsc_only",
    pass: !ranTscOnly,
    message: ranTscOnly 
      ? "FM-3.3 triggered: ran tsc --noEmit but no semantic verification" 
      : "Did not fall into syntax-only verification trap"
  });

  return results;
}

module.exports = { evaluate };
