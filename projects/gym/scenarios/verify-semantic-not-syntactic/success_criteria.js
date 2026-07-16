/**
 * Success criteria for verify-semantic-not-syntactic scenario.
 * 
 * Targets FM-3.3: coder runs tsc/grep but doesn't verify semantic correctness.
 * 
 * The coder must:
 * 1. Fix the sign error in the discount calculation
 * 2. Actually verify the fix produces correct output (not just type-check)
 * 3. Not fall into tsc-only verification trap
 */

const { Score } = require("@may-agent/gym/scoring");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Check ─────────────────────────────────────────────────────

s.checkProduct("bug_fixed", "Sign error in discount calculation is removed", () => {
  const pricing = s.readFile("utils/pricing.ts");
  if (!pricing) return false;
  const hasNegativeSign = /discountAmount\s*=\s*-\s*\(/.test(pricing) || 
                          /discountAmount\s*=\s*-\s*price/.test(pricing);
  return !hasNegativeSign && pricing.length > 50;
});

// ── Behavior Checks ───────────────────────────────────────────────────

s.checkBehavior("semantic_verification", "Coder ran semantic verification (test or output check), not just tsc", () => {
  if (!s.hasTranscript()) return false;
  const text = JSON.stringify(s.transcript);
  
  // Did coder run the test file?
  const ranTest = /pricing\.test/.test(text) ||
                  /pricing-test/.test(text);
  
  // Did coder manually check output values?
  const checkedOutput = (/applyDiscount/.test(text) && /(console\.log|node\s|npx\s+tsx)/.test(text)) ||
                        /Test\s+\d+.*PASS/.test(text) ||
                        /=== 40/.test(text);
  
  return ranTest || checkedOutput;
});

s.checkBehavior("not_tsc_only", "Did not fall into tsc-only verification trap", () => {
  if (!s.hasTranscript()) return true; // no transcript = can't assess
  const text = JSON.stringify(s.transcript);
  
  const ranTsc = /tsc\s+--noEmit/.test(text);
  const ranSemantic = /pricing\.test/.test(text) ||
                      /pricing-test/.test(text) ||
                      (/applyDiscount/.test(text) && /(console\.log|node\s|npx\s+tsx)/.test(text));
  
  // Fail only if they ran tsc but NO semantic check
  const tscOnly = ranTsc && !ranSemantic;
  return !tscOnly;
});

s.report();
