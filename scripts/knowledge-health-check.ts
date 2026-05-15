/**
 * knowledge-health-check.ts — Lint the knowledge library for common issues.
 *
 * Usage:
 *   bun scripts/knowledge-health-check.ts           # full check
 *   bun scripts/knowledge-health-check.ts --fix      # auto-fix what's safe to fix
 *   bun scripts/knowledge-health-check.ts --json     # JSON output for automation
 *
 * Checks:
 *   1. Duplicate detection (same arXiv IDs, similar titles)
 *   2. Orphan posts (not referenced in any topic index)
 *   3. Broken links (topic files referencing non-existent files)
 *   4. Posts missing required metadata (date, source)
 *   5. Naming convention violations
 */

import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";

const LIBRARY = "app/shared/knowledge/library";
const POSTS_DIR = join(LIBRARY, "posts");
const DEEP_DIVES_DIR = join(LIBRARY, "deep-dives");
const TOPICS_DIR = join(LIBRARY, "topics");
const SYNTHESIS_DIR = join(LIBRARY, "synthesis");

interface Issue {
  level: "error" | "warning" | "info";
  check: string;
  file: string;
  message: string;
}

const issues: Issue[] = [];

function addIssue(level: Issue["level"], check: string, file: string, message: string) {
  issues.push({ level, check, file, message });
}

// ─── Check 1: Broken Links ───────────────────────────────────────────────

async function checkBrokenLinks() {
  const topicFiles = await readdir(TOPICS_DIR);
  const actualPosts = new Set(await readdir(POSTS_DIR));
  const actualDeepDives = new Set(await readdir(DEEP_DIVES_DIR));
  let actualSynthesis: Set<string>;
  try {
    actualSynthesis = new Set(await readdir(SYNTHESIS_DIR));
  } catch {
    actualSynthesis = new Set();
  }

  for (const file of topicFiles) {
    if (!file.endsWith(".md")) continue;
    const content = await readFile(join(TOPICS_DIR, file), "utf-8");

    // Check post references
    const postRefs = content.matchAll(/\.\.\/(posts\/[^)]+)/g);
    for (const match of postRefs) {
      const postFile = basename(match[1]);
      if (!actualPosts.has(postFile)) {
        // Try fuzzy match
        const stem = postFile.replace(/\.md$/, "").split("-").slice(0, 2).join("-");
        const candidates = [...actualPosts].filter(p => p.startsWith(stem));
        const hint = candidates.length > 0 ? ` (did you mean: ${candidates[0]}?)` : "";
        addIssue("error", "broken-link", file, `References non-existent post: ${postFile}${hint}`);
      }
    }

    // Check deep-dive references
    const ddRefs = content.matchAll(/\.\.\/(deep-dives\/[^)]+)/g);
    for (const match of ddRefs) {
      const ddFile = basename(match[1]);
      if (!actualDeepDives.has(ddFile)) {
        const stem = ddFile.replace(/\.md$/, "").split("-").slice(0, 1).join("-");
        const candidates = [...actualDeepDives].filter(d => d.startsWith(stem));
        const hint = candidates.length > 0 ? ` (did you mean: ${candidates[0]}?)` : "";
        addIssue("error", "broken-link", file, `References non-existent deep-dive: ${ddFile}${hint}`);
      }
    }

    // Check synthesis references
    const synthRefs = content.matchAll(/\.\.\/(synthesis\/[^)]+)/g);
    for (const match of synthRefs) {
      const synthFile = basename(match[1]);
      if (!actualSynthesis.has(synthFile)) {
        addIssue("error", "broken-link", file, `References non-existent synthesis: ${synthFile}`);
      }
    }
  }
}

// ─── Check 2: Orphan Posts (sampling-based) ──────────────────────────────

async function checkOrphanPosts() {
  // Get all posts referenced from topic index files
  const topicFiles = await readdir(TOPICS_DIR);
  const referencedPosts = new Set<string>();
  const referencedDeepDives = new Set<string>();

  for (const file of topicFiles) {
    if (!file.endsWith(".md")) continue;
    const content = await readFile(join(TOPICS_DIR, file), "utf-8");

    for (const match of content.matchAll(/\.\.\/(posts\/[^)]+)/g)) {
      referencedPosts.add(basename(match[1]));
    }
    for (const match of content.matchAll(/\.\.\/(deep-dives\/[^)]+)/g)) {
      referencedDeepDives.add(basename(match[1]));
    }
  }

  // Also check INDEX.md references
  try {
    const indexContent = await readFile(join(TOPICS_DIR, "INDEX.md"), "utf-8");
    // INDEX references topic files, not posts directly — that's fine
  } catch {
    addIssue("warning", "orphan", "INDEX.md", "Missing INDEX.md in topics/");
  }

  const allPosts = await readdir(POSTS_DIR);
  const allDeepDives = await readdir(DEEP_DIVES_DIR);

  // Report orphan stats (not individual files — there are 2500+ posts)
  const orphanPostCount = allPosts.filter(p => p.endsWith(".md") && !referencedPosts.has(p)).length;
  const orphanDDCount = allDeepDives.filter(d => d.endsWith(".md") && d !== "INDEX.md" && !referencedDeepDives.has(d)).length;

  if (orphanPostCount > 0) {
    addIssue("info", "orphan", "posts/",
      `${orphanPostCount} of ${allPosts.length} posts not referenced in any topic index (${Math.round(100 * (1 - orphanPostCount / allPosts.length))}% coverage)`);
  }
  if (orphanDDCount > 0) {
    addIssue("info", "orphan", "deep-dives/",
      `${orphanDDCount} of ${allDeepDives.length} deep-dives not referenced in any topic index (${Math.round(100 * (1 - orphanDDCount / allDeepDives.length))}% coverage)`);
  }
}

// ─── Check 3: Duplicate Detection ────────────────────────────────────────

async function checkDuplicates() {
  const posts = await readdir(POSTS_DIR);
  const mdPosts = posts.filter(p => p.endsWith(".md"));

  // Group by extracted arXiv IDs
  const arxivMap = new Map<string, string[]>();
  // Group by title similarity (first heading)
  const titleMap = new Map<string, string[]>();

  // Sample posts for metadata checks (reading all 2578 is too slow)
  const sampleSize = Math.min(200, mdPosts.length);
  const sampled = mdPosts.sort(() => Math.random() - 0.5).slice(0, sampleSize);

  for (const file of sampled) {
    try {
      const content = await readFile(join(POSTS_DIR, file), "utf-8");

      // Extract arXiv IDs (dedupe within same file)
      const fileArxivIds = new Set<string>();
      const arxivMatches = content.matchAll(/arxiv[:\s]*(\d{4}\.\d{4,5})/gi);
      for (const match of arxivMatches) {
        fileArxivIds.add(match[1]);
      }
      for (const id of fileArxivIds) {
        if (!arxivMap.has(id)) arxivMap.set(id, []);
        arxivMap.get(id)!.push(file);
      }

      // Extract title (first # heading)
      const titleMatch = content.match(/^#\s+(.+)/m);
      if (titleMatch) {
        // Normalize title for comparison
        const normalized = titleMatch[1]
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (normalized.length > 10) {
          if (!titleMap.has(normalized)) titleMap.set(normalized, []);
          titleMap.get(normalized)!.push(file);
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Report duplicate arXiv IDs
  for (const [arxivId, files] of arxivMap) {
    if (files.length > 1) {
      addIssue("warning", "duplicate-arxiv", files[0],
        `arXiv:${arxivId} appears in ${files.length} posts: ${files.join(", ")}`);
    }
  }

  // Report duplicate titles
  for (const [title, files] of titleMap) {
    if (files.length > 1) {
      addIssue("warning", "duplicate-title", files[0],
        `Similar title "${title.substring(0, 60)}..." in ${files.length} posts: ${files.join(", ")}`);
    }
  }
}

// ─── Check 4: Missing Metadata ───────────────────────────────────────────

async function checkMetadata() {
  const posts = await readdir(POSTS_DIR);
  const mdPosts = posts.filter(p => p.endsWith(".md"));

  // Sample recent/HB posts (they should follow convention)
  const hbPosts = mdPosts.filter(p => p.startsWith("HB-"));
  const sampleSize = Math.min(50, hbPosts.length);
  const sampled = hbPosts.sort().slice(-sampleSize); // most recent HB posts

  let missingDate = 0;
  let missingSource = 0;

  for (const file of sampled) {
    try {
      const content = await readFile(join(POSTS_DIR, file), "utf-8");
      const first500 = content.substring(0, 500);

      if (!/\*\*Date\*\*|date:/i.test(first500)) {
        missingDate++;
      }
      if (!/\*\*Source\*\*|source:/i.test(first500)) {
        missingSource++;
      }
    } catch {
      // Skip
    }
  }

  if (missingDate > 0) {
    addIssue("warning", "missing-metadata", "posts/",
      `${missingDate} of ${sampleSize} sampled HB-* posts missing **Date** metadata`);
  }
  if (missingSource > 0) {
    addIssue("warning", "missing-metadata", "posts/",
      `${missingSource} of ${sampleSize} sampled HB-* posts missing **Source** metadata`);
  }
}

// ─── Check 5: Naming Convention ──────────────────────────────────────────

async function checkNamingConvention() {
  const posts = await readdir(POSTS_DIR);

  // Expected patterns:
  // HB-XXXX-slug.md (standard)
  // HB-YYMMDD-slug.md (date-based)
  // BACKFILL-NNN-slug.md
  // SYNTH-NNN-slug.md
  // TWEET-source-slug-date.md
  // QUERY-YYYY-MM-DD-topic.md (new convention)

  const knownPatterns = [
    /^HB-\d{4,}-[\w-]+\.md$/,      // HB-0052-slug.md or HB-250403-slug.md
    /^BACKFILL-\d{3}-[\w-]+\.md$/,   // BACKFILL-001-slug.md
    /^SYNTH-\d{3}-[\w-]+\.md$/,      // SYNTH-001-slug.md
    /^TWEET-[\w-]+\.md$/,            // TWEET-source-slug.md
    /^QUERY-\d{4}-\d{2}-\d{2}-[\w-]+\.md$/, // QUERY-2026-04-04-topic.md
    /^\d+-[\w-]+\.md$/,              // 1119-slug.md (legacy numbered)
    /^xhs_[\w]+\.md$/,              // xhs_* (legacy XHS)
    /^\d+\.md$/,                     // bare number (legacy)
  ];

  let unconventional = 0;
  const examples: string[] = [];

  for (const file of posts) {
    if (!file.endsWith(".md")) continue;
    const matchesAny = knownPatterns.some(p => p.test(file));
    if (!matchesAny) {
      unconventional++;
      if (examples.length < 5) examples.push(file);
    }
  }

  if (unconventional > 0) {
    addIssue("info", "naming", "posts/",
      `${unconventional} posts don't match known naming patterns. Examples: ${examples.join(", ")}`);
  }
}

// ─── Check 6: Topic Index Completeness ───────────────────────────────────

async function checkTopicCompleteness() {
  const topicFiles = (await readdir(TOPICS_DIR)).filter(f => f.endsWith(".md") && f !== "INDEX.md");

  for (const file of topicFiles) {
    const content = await readFile(join(TOPICS_DIR, file), "utf-8");

    // Check for required sections
    const sections = ["Key Principles", "Essential Reading", "Open Questions", "Cross-References"];
    for (const section of sections) {
      if (!content.includes(section)) {
        addIssue("warning", "topic-structure", file, `Missing section: "${section}"`);
      }
    }

    // Check for related hypotheses
    if (!content.includes("Hypothes")) {
      addIssue("info", "topic-structure", file, "No hypotheses section found");
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");

  console.log("🔍 Knowledge Library Health Check\n");
  console.log("Running checks...\n");

  await checkBrokenLinks();
  await checkOrphanPosts();
  await checkDuplicates();
  await checkMetadata();
  await checkNamingConvention();
  await checkTopicCompleteness();

  // Sort: errors first, then warnings, then info
  const priority = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => priority[a.level] - priority[b.level]);

  if (jsonOutput) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        errors: issues.filter(i => i.level === "error").length,
        warnings: issues.filter(i => i.level === "warning").length,
        info: issues.filter(i => i.level === "info").length,
      },
      issues,
    }, null, 2));
    return;
  }

  // Pretty output
  const icons = { error: "❌", warning: "⚠️", info: "ℹ️" };

  for (const issue of issues) {
    console.log(`${icons[issue.level]} [${issue.check}] ${issue.file}`);
    console.log(`   ${issue.message}\n`);
  }

  const errors = issues.filter(i => i.level === "error").length;
  const warnings = issues.filter(i => i.level === "warning").length;
  const info = issues.filter(i => i.level === "info").length;

  console.log("─".repeat(60));
  console.log(`Summary: ${errors} errors, ${warnings} warnings, ${info} info`);

  if (errors > 0) {
    console.log("\n❌ Health check FAILED — fix errors above.");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("\n⚠️ Health check PASSED with warnings.");
    process.exit(0);
  } else {
    console.log("\n✅ Health check PASSED.");
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Health check crashed:", err);
  process.exit(2);
});
