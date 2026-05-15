/**
 * knowledge-compile.ts — Scan new posts and assign them to topic indexes.
 *
 * Usage:
 *   bun scripts/knowledge-compile.ts                    # dry-run: show what would be added
 *   bun scripts/knowledge-compile.ts --since 2026-04-01 # only posts newer than date
 *   bun scripts/knowledge-compile.ts --apply            # actually update topic files
 *
 * How it works:
 *   1. Reads all topic index files to understand categories
 *   2. Scans posts/ for files not already referenced in any topic
 *   3. Reads each unindexed post's content, extracts title + keywords
 *   4. Assigns to best-matching topic via keyword matching
 *   5. Outputs a compilation report (or applies changes with --apply)
 *
 * This is designed to be run periodically (e.g., weekly) to keep the
 * knowledge base organized without requiring LLM involvement.
 */

import { readdir, readFile, appendFile, writeFile } from "fs/promises";
import { join, basename } from "path";

const LIBRARY = "app/shared/knowledge/library";
const POSTS_DIR = join(LIBRARY, "posts");
const DEEP_DIVES_DIR = join(LIBRARY, "deep-dives");
const TOPICS_DIR = join(LIBRARY, "topics");

// ─── Topic Keyword Map ───────────────────────────────────────────────────
// Each topic has keywords that posts are matched against.
// This is the "compiled knowledge" — extracted from the topic descriptions.

interface TopicDef {
  file: string;
  name: string;
  keywords: string[];
  section: string; // which section to append new entries to
}

const TOPICS: TopicDef[] = [
  {
    file: "01-multi-agent-coordination.md",
    name: "Multi-Agent Coordination",
    keywords: [
      "multi-agent", "coordination", "topology", "sequential", "hierarchy",
      "debate", "collective", "consensus", "communication", "distributed",
      "delegation", "orchestrat", "collaboration", "team", "swarm",
      "mas ", "multi agent", "scaling law", "decentraliz"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "02-memory-knowledge.md",
    name: "Memory & Knowledge",
    keywords: [
      "memory", "knowledge", "retrieval", "rag", "embedding", "vector",
      "persistent", "episodic", "semantic", "context window", "long-term",
      "forgetting", "compilation", "index", "omnimem", "trajectory memory"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "03-self-evolution-learning.md",
    name: "Self-Evolution & Learning",
    keywords: [
      "self-evolv", "self-improv", "learning", "evolution", "meta-learn",
      "adaptation", "skill acqui", "experience replay", "self-teach",
      "trace2skill", "reflexion", "curriculum", "training"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "04-reasoning-cognition.md",
    name: "Reasoning & Cognition",
    keywords: [
      "reasoning", "cogniti", "chain-of-thought", "cot ", "planning",
      "problem solv", "logic", "inference", "thinking", "reflection",
      "metacognit", "uncertainty", "calibration"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "05-security-safety.md",
    name: "Security & Safety",
    keywords: [
      "security", "safety", "attack", "jailbreak", "injection", "prompt inject",
      "alignment", "guardrail", "sandbox", "vulnerab", "threat", "adversar",
      "poison", "backdoor", "collusion", "misalign"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "06-governance-institutional.md",
    name: "Governance & Institutional",
    keywords: [
      "governance", "institution", "regulation", "policy", "compliance",
      "audit", "accountability", "oversight", "constitution", "rights",
      "ethical", "societal"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "07-tool-use-workflows.md",
    name: "Tool Use & Workflows",
    keywords: [
      "tool", "workflow", "mcp", "function call", "api", "plugin",
      "skill", "harness", "react loop", "agentic", "browser",
      "code generat", "framework"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "08-evaluation-benchmarking.md",
    name: "Evaluation & Benchmarking",
    keywords: [
      "evaluat", "benchmark", "metric", "scoring", "assessment",
      "leaderboard", "test", "swe-bench", "humaneval", "arena",
      "quality", "reliability"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "09-emergent-behavior.md",
    name: "Emergent Behavior",
    keywords: [
      "emergent", "unexpected", "spontaneous", "self-organiz", "phase transition",
      "complexity", "social", "culture", "memetic", "drift",
      "deception", "self-preserv", "emotion"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  },
  {
    file: "10-agent-design-patterns.md",
    name: "Agent Design Patterns",
    keywords: [
      "design pattern", "architecture", "pattern", "agent design",
      "middleware", "runtime", "harness", "modular", "plugin",
      "opencode", "claude code", "cursor", "copilot"
    ],
    section: "## Additional Posts (Auto-Indexed)"
  }
];

// ─── Helper: Extract post info ───────────────────────────────────────────

interface PostInfo {
  file: string;
  title: string;
  date: string | null;
  contentLower: string;
}

async function extractPostInfo(file: string): Promise<PostInfo | null> {
  try {
    const content = await readFile(join(POSTS_DIR, file), "utf-8");
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].replace(/[*_]/g, "").trim() : file.replace(/\.md$/, "");

    // Try to extract date
    const dateMatch = content.match(/\*\*Date\*\*[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i)
      || content.match(/Date[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i)
      || file.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : null;

    return {
      file,
      title: title.substring(0, 80),
      date,
      contentLower: content.toLowerCase().substring(0, 2000), // first 2KB for keyword matching
    };
  } catch {
    return null;
  }
}

// ─── Helper: Assign post to topic ────────────────────────────────────────

function assignTopic(post: PostInfo): { topic: TopicDef; score: number } | null {
  let bestTopic: TopicDef | null = null;
  let bestScore = 0;

  for (const topic of TOPICS) {
    let score = 0;
    for (const keyword of topic.keywords) {
      // Check title (3x weight) and content (1x weight)
      const titleLower = post.title.toLowerCase();
      if (titleLower.includes(keyword)) score += 3;
      if (post.contentLower.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  // Minimum score threshold to avoid random assignment
  if (bestScore >= 3 && bestTopic) {
    return { topic: bestTopic, score: bestScore };
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes("--apply");
  const sinceIdx = args.indexOf("--since");
  const sinceDate = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

  console.log("📚 Knowledge Compilation\n");

  // Step 1: Find all currently-referenced posts across topic files
  const referenced = new Set<string>();
  const topicFiles = (await readdir(TOPICS_DIR)).filter(f => f.endsWith(".md") && f !== "INDEX.md");

  for (const file of topicFiles) {
    const content = await readFile(join(TOPICS_DIR, file), "utf-8");
    for (const match of content.matchAll(/\.\.\/(posts\/[^)]+)/g)) {
      referenced.add(basename(match[1]));
    }
  }

  console.log(`Found ${referenced.size} posts already referenced in topic indexes.`);

  // Step 2: Find unindexed posts
  const allPosts = (await readdir(POSTS_DIR)).filter(f => f.endsWith(".md"));
  const unindexed = allPosts.filter(f => !referenced.has(f));
  console.log(`Found ${unindexed.length} unindexed posts.\n`);

  // Step 3: Filter by date if --since provided
  let candidates = unindexed;
  if (sinceDate) {
    // Use file mtime as proxy for post date
    const { stat } = await import("fs/promises");
    const filtered: string[] = [];
    const sinceTime = new Date(sinceDate).getTime();
    for (const file of unindexed) {
      try {
        const s = await stat(join(POSTS_DIR, file));
        if (s.mtimeMs >= sinceTime) filtered.push(file);
      } catch {
        // skip
      }
    }
    candidates = filtered;
    console.log(`After --since ${sinceDate} filter: ${candidates.length} candidates.\n`);
  }

  // Step 4: Categorize (sample if too many — avoid reading all 2500+)
  const maxToProcess = 100;
  if (candidates.length > maxToProcess) {
    // Prioritize recent HB-* posts
    const hb = candidates.filter(f => f.startsWith("HB-"));
    const others = candidates.filter(f => !f.startsWith("HB-"));
    candidates = [...hb.slice(-maxToProcess / 2), ...others.slice(-maxToProcess / 2)];
    console.log(`Sampling ${candidates.length} posts (prioritizing HB-* posts).\n`);
  }

  // Step 5: Assign to topics
  const assignments = new Map<string, { post: PostInfo; score: number }[]>();
  const unassigned: PostInfo[] = [];
  let processed = 0;

  for (const file of candidates) {
    const info = await extractPostInfo(file);
    if (!info) continue;
    processed++;

    const assignment = assignTopic(info);
    if (assignment) {
      const key = assignment.topic.file;
      if (!assignments.has(key)) assignments.set(key, []);
      assignments.get(key)!.push({ post: info, score: assignment.score });
    } else {
      unassigned.push(info);
    }
  }

  // Step 6: Report
  console.log(`Processed ${processed} posts:\n`);

  let totalAssigned = 0;
  for (const [topicFile, posts] of assignments) {
    const topicName = TOPICS.find(t => t.file === topicFile)?.name || topicFile;
    console.log(`📂 ${topicName} (${topicFile}): +${posts.length} posts`);
    for (const { post, score } of posts.sort((a, b) => b.score - a.score).slice(0, 5)) {
      console.log(`   [score=${score}] ${post.file} — ${post.title}`);
    }
    if (posts.length > 5) console.log(`   ... and ${posts.length - 5} more`);
    totalAssigned += posts.length;
    console.log();
  }

  if (unassigned.length > 0) {
    console.log(`❓ Unassigned (no strong topic match): ${unassigned.length}`);
    for (const post of unassigned.slice(0, 5)) {
      console.log(`   ${post.file} — ${post.title}`);
    }
    if (unassigned.length > 5) console.log(`   ... and ${unassigned.length - 5} more`);
    console.log();
  }

  console.log(`Summary: ${totalAssigned} assigned, ${unassigned.length} unassigned out of ${processed} processed.`);

  // Step 7: Apply if requested
  if (applyMode) {
    console.log("\n📝 Applying changes...\n");

    for (const [topicFile, posts] of assignments) {
      const topicPath = join(TOPICS_DIR, topicFile);
      const existingContent = await readFile(topicPath, "utf-8");

      // Check if auto-indexed section already exists
      const sectionHeader = "## Additional Posts (Auto-Indexed)";
      let newContent: string;

      const newEntries = posts
        .sort((a, b) => b.score - a.score)
        .map(({ post }) => `| [${post.file.replace(/\.md$/, "")}](../posts/${post.file}) | ${post.title} |`)
        .join("\n");

      if (existingContent.includes(sectionHeader)) {
        // Append to existing section
        const insertPoint = existingContent.indexOf(sectionHeader) + sectionHeader.length;
        const afterSection = existingContent.substring(insertPoint);
        const nextSection = afterSection.indexOf("\n## ");
        if (nextSection > 0) {
          newContent = existingContent.substring(0, insertPoint)
            + afterSection.substring(0, nextSection)
            + "\n" + newEntries + "\n"
            + afterSection.substring(nextSection);
        } else {
          newContent = existingContent + "\n" + newEntries + "\n";
        }
      } else {
        // Add new section at end
        newContent = existingContent.trimEnd()
          + "\n\n" + sectionHeader + "\n\n"
          + "| File | Description |\n"
          + "|------|-------------|\n"
          + newEntries + "\n";
      }

      await writeFile(topicPath, newContent);
      console.log(`  ✅ Updated ${topicFile} (+${posts.length} posts)`);
    }

    // Write compilation log
    const logEntry = `\n## Compilation ${new Date().toISOString().split("T")[0]}\n\n`
      + `- Posts processed: ${processed}\n`
      + `- Assigned to topics: ${totalAssigned}\n`
      + `- Unassigned: ${unassigned.length}\n`
      + `- Topics updated: ${assignments.size}\n`;

    const logPath = join(LIBRARY, "COMPILATION-LOG.md");
    try {
      await appendFile(logPath, logEntry);
    } catch {
      await writeFile(logPath, "# Knowledge Compilation Log\n" + logEntry);
    }

    console.log("\n✅ Compilation complete. Run knowledge-health-check.ts to verify.");
  } else {
    console.log("\n(Dry run — use --apply to make changes)");
  }
}

main().catch(err => {
  console.error("Compilation failed:", err);
  process.exit(1);
});
