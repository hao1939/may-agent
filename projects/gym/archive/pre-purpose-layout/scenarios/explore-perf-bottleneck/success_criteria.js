/**
 * Success criteria for explore-perf-bottleneck scenario.
 *
 * The agent must:
 * 1. Run benchmark.js to measure current query counts
 * 2. Read server.js and database.js to understand the code
 * 3. Identify N+1 query patterns in listProducts, getProduct, listCategories
 * 4. Produce an optimization-report.md with specific findings
 *
 * Key bottlenecks to identify:
 * - listProducts: getCategoryById called per product in filter (N+1)
 * - listProducts: getCategoryById called AGAIN per product in enrichment (N+1)
 * - listProducts: getDiscountsForProduct per product (N+1)
 * - listProducts: getReviewsForProduct per product (N+1)
 * - getProduct: getRelatedProducts does N+1 internally (getProductById per related)
 * - getProduct: enrichedRelated does getCategoryById + getReviewsForProduct per related (N+1)
 * - listCategories: getAllProducts called per category (N+1) — full table scan each time
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// P1: Optimization report exists and has substance
s.checkProduct("report-exists", "Optimization report was created with substantive content", () => {
  const report = s.readFile("optimization-report.md") || s.readFile("environment/optimization-report.md");
  return report !== null && report.trim().length > 300;
});

// P2: Report identifies N+1 in listProducts
s.checkProduct("identifies-list-n1", "Report identifies N+1 queries in listProducts", () => {
  const report = s.readFile("optimization-report.md") || s.readFile("environment/optimization-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return (lower.includes("listproducts") || lower.includes("list_products") || lower.includes("list products")) &&
    (lower.includes("n+1") || lower.includes("n + 1") || lower.includes("per product") || lower.includes("each product") || lower.includes("for each"));
});

// P3: Report identifies N+1 in getProduct/related products
s.checkProduct("identifies-related-n1", "Report identifies N+1 in getProduct related enrichment", () => {
  const report = s.readFile("optimization-report.md") || s.readFile("environment/optimization-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return (lower.includes("getproduct") || lower.includes("get_product") || lower.includes("related")) &&
    (lower.includes("n+1") || lower.includes("n + 1") || lower.includes("per related") || lower.includes("each related") || lower.includes("for each"));
});

// P4: Report identifies listCategories inefficiency
s.checkProduct("identifies-categories-n1", "Report identifies listCategories repeated full scan", () => {
  const report = s.readFile("optimization-report.md") || s.readFile("environment/optimization-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  return (lower.includes("listcategories") || lower.includes("list_categories") || lower.includes("categories")) &&
    (lower.includes("getAllProducts") || lower.includes("getallproducts") || lower.includes("all products") || lower.includes("full scan") || lower.includes("every category"));
});

// P5: Report includes specific fix recommendations
s.checkProduct("has-fix-recommendations", "Report includes specific fix recommendations (batch/join/cache)", () => {
  const report = s.readFile("optimization-report.md") || s.readFile("environment/optimization-report.md");
  if (!report) return false;
  const lower = report.toLowerCase();
  // Should mention at least one of: batch, join, cache, map, preload, eager
  return /(?:batch|join|cache|map\b|preload|eager|lookup|index|group)/.test(lower);
});

// B1: Agent ran the benchmark
s.checkBehavior("ran-benchmark", "Agent ran benchmark.js to measure actual query counts", () => {
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(c => {
    const cmd = String((c.arguments || {}).command || "");
    return cmd.includes("benchmark") && (cmd.includes("node") || cmd.includes("bun"));
  });
});

// B2: Agent read server.js (the code with bottlenecks)
s.checkBehavior("read-server", "Agent read server.js to understand the API code", () => {
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  const readServer = reads.some(c => String((c.arguments || {}).path || "").includes("server.js"));
  const catServer = bashCalls.some(c => String((c.arguments || {}).command || "").includes("server.js"));
  return readServer || catServer;
});

// B3: Agent read database.js (to understand query counting mechanism)
s.checkBehavior("read-database", "Agent read database.js to understand the query mechanism", () => {
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  const readDb = reads.some(c => String((c.arguments || {}).path || "").includes("database.js"));
  const catDb = bashCalls.some(c => String((c.arguments || {}).command || "").includes("database.js"));
  return readDb || catDb;
});

// B4: Agent did NOT modify source code (investigation only)
s.checkBehavior("no-code-modification", "Agent did not modify source code (investigation task only)", () => {
  const serverOriginal = s.readFile("server.js") || s.readFile("environment/server.js");
  const dbOriginal = s.readFile("database.js") || s.readFile("environment/database.js");
  // This is imperfect — we'd need baseline comparison. 
  // Check that edit/write tool calls didn't target these files
  const writes = s.toolCalls("write");
  const edits = s.toolCalls("edit");
  const modifiedSource = [...writes, ...edits].some(c => {
    const path = String((c.arguments || {}).path || "");
    return path.includes("server.js") || path.includes("database.js") || path.includes("benchmark.js");
  });
  return !modifiedSource;
});

s.report();
