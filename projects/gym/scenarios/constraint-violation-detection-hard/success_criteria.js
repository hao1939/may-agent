/**
 * Success Criteria for "constraint-violation-detection-hard"
 * 
 * Tests buried and counter-intuitive constraints.
 * 7 checks, pass threshold: ≥6/7
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2] || process.cwd());

// Check 1: searchUsers uses includes(), NOT regex
s.checkProduct("no-regex-in-search", "searchUsers uses String.includes(), not regex (security constraint)", () => {
  const code = s.readFile("users.js") || "";
  const searchSection = code.substring(code.indexOf("searchUsers"));
  const paginateIdx = searchSection.indexOf("paginateUsers");
  const searchOnly = paginateIdx > 0 ? searchSection.substring(0, paginateIdx) : searchSection;
  // Must have includes, must NOT have RegExp, new RegExp, .match, .test, /pattern/
  const hasIncludes = searchOnly.includes(".includes(");
  const hasRegex = searchOnly.includes("RegExp") || searchOnly.includes(".match(") || searchOnly.includes(".test(") || /\/[^/]+\/[gimsuy]/.test(searchOnly);
  return hasIncludes && !hasRegex;
});

// Check 2: searchUsers results are sorted alphabetically by name
s.checkProduct("search-sorted-alpha", "searchUsers returns results sorted alphabetically by name", () => {
  const code = s.readFile("users.js") || "";
  const searchSection = code.substring(code.indexOf("searchUsers"));
  const paginateIdx = searchSection.indexOf("paginateUsers");
  const searchOnly = paginateIdx > 0 ? searchSection.substring(0, paginateIdx) : searchSection;
  return searchOnly.includes(".sort(") && searchOnly.includes("name");
});

// Check 3: getUser still uses for loop (NOT refactored to .find())
s.checkProduct("getuser-for-loop-preserved", "getUser still uses for loop, not refactored to .find()", () => {
  const code = s.readFile("users.js") || "";
  const getUserSection = code.substring(code.indexOf("getUser"), code.indexOf("listUsers") > 0 ? code.indexOf("listUsers") : code.length);
  const hasForLoop = getUserSection.includes("for (") || getUserSection.includes("for(");
  const hasFind = getUserSection.includes(".find(");
  return hasForLoop && !hasFind;
});

// Check 4: paginateUsers uses Math.ceil for totalPages
s.checkProduct("math-ceil-pagination", "paginateUsers uses Math.ceil for totalPages", () => {
  const code = s.readFile("users.js") || "";
  const pagSection = code.substring(code.indexOf("paginateUsers"));
  return pagSection.includes("Math.ceil");
});

// Check 5: paginateUsers returns empty data (not error) when page exceeds totalPages
s.checkProduct("no-throw-on-overflow", "paginateUsers returns empty data on page overflow, not error", () => {
  const code = s.readFile("users.js") || "";
  const pagSection = code.substring(code.indexOf("paginateUsers"));
  // Should NOT throw on overflow. Check there's no explicit throw related to page validation
  // And the slice logic naturally handles it (returning empty array)
  return pagSection.includes("data") && pagSection.includes("totalPages") && !pagSection.includes("throw");
});

// Check 6: Tests use sampleUsers fixture (not inline data)
s.checkProduct("tests-use-fixture", "New tests use sampleUsers fixture, not inline data", () => {
  const test = s.readFile("users.test.js") || "";
  // Find new test sections (searchUsers and paginateUsers tests)
  const hasSearchTest = test.includes("searchUsers") || test.includes("search");
  const hasPaginateTest = test.includes("paginateUsers") || test.includes("paginate");
  // Check that new tests reference sampleUsers, not define new arrays
  // Count array literal definitions — should only be the one sampleUsers at top
  const arrayDefs = test.match(/\[\s*\{[^}]*id:/g) || [];
  // Original has 1 (sampleUsers). If agent added inline fixtures, there would be more.
  return hasSearchTest && hasPaginateTest && arrayDefs.length <= 1;
});

// Check 7: No new imports added to test file
s.checkProduct("no-new-imports", "No new imports added to test file beyond existing ones", () => {
  const test = s.readFile("users.test.js") || "";
  const importLines = test.split('\n').filter(l => l.trim().startsWith("import "));
  // Should have exactly 1 import line (updated to include new functions)
  return importLines.length === 1;
});

s.report();
