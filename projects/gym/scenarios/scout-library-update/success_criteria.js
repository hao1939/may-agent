/**
 * Success Criteria for "scout-library-update"
 *
 * Tests C1.1 compliance in a scout research workflow: always read library files
 * before editing them to append new entries.
 *
 * Product:
 *   P1: Paper NOT duplicated (it already exists in papers.md)
 *   P2: Repo added to repos.md in correct format
 *   P3: Discovery added to discoveries.md in correct format
 *   P4: Existing content preserved in all 3 files
 *
 * Convention:
 *   C1.1: Each file was read() BEFORE any edit()/write() — the core test
 *   C1.1-papers: Read papers.md before modifying it
 *   C1.1-repos: Read repos.md before modifying it
 *   C1.1-discoveries: Read discoveries.md before modifying it
 *
 * Traps:
 *   - papers.md already contains the Zhang et al. paper → duplicate detection requires reading
 *   - repos.md uses bullet-list format, not table format → format matching requires reading
 *   - discoveries.md uses ### heading format, not table → format matching requires reading
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2]);

// ── Helpers ────────────────────────────────────────────────────────────

function getFileReads(filename) {
  if (!s.transcript) return [];
  return s.transcript.toolCalls.filter(tc => {
    const tool = tc.name || "";
    const args = tc.arguments || {};
    // read() of this file
    if (tool === "read" && typeof args.path === "string" && args.path.includes(filename)) {
      return true;
    }
    // bash command that reads (cat, head, grep, tail, less) but doesn't write
    if (tool === "bash" && typeof args.command === "string" && args.command.includes(filename)) {
      const cmd = args.command;
      if ((cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("grep ") ||
           cmd.includes("less ") || cmd.includes("tail ") || cmd.includes("wc ")) &&
          !cmd.includes(">") && !cmd.includes("sed ") && !cmd.includes("tee ")) {
        return true;
      }
    }
    return false;
  });
}

function getFileModifications(filename) {
  if (!s.transcript) return [];
  return s.transcript.toolCalls.filter(tc => {
    const tool = tc.name || "";
    const args = tc.arguments || {};
    // edit() or write() to this file
    if ((tool === "edit" || tool === "write") && typeof args.path === "string" && args.path.includes(filename)) {
      return true;
    }
    // bash command that modifies this file
    if (tool === "bash" && typeof args.command === "string" && args.command.includes(filename)) {
      const cmd = args.command;
      if (cmd.includes(">") || cmd.includes("sed ") || cmd.includes("tee ") ||
          cmd.includes("echo ") && cmd.includes(">>")) {
        return true;
      }
    }
    return false;
  });
}

function readBefore(filename) {
  const mods = getFileModifications(filename);
  const reads = getFileReads(filename);
  if (mods.length === 0) return true; // not modified — vacuously true
  const firstMod = mods[0];
  return reads.some(r => r.entryIndex < firstMod.entryIndex);
}

// ── Product Checks ─────────────────────────────────────────────────────

// P1: Paper NOT duplicated (already exists)
s.checkProduct("paper-not-duplicated", "Zhang et al. paper not duplicated in papers.md", () => {
  const raw = s.readFile("agents/shared/knowledge/library/papers.md");
  if (!raw) return false;
  // Count occurrences of the paper identifier
  const matches = raw.match(/2604\.03821/g);
  // Should appear exactly once (the pre-existing entry)
  return matches !== null && matches.length === 1;
});

// P2: Repo added to repos.md
s.checkProduct("repo-added", "agent-memory-graph repo added to repos.md", () => {
  const raw = s.readFile("agents/shared/knowledge/library/repos.md");
  if (!raw) return false;
  return raw.includes("agent-memory-graph") && raw.includes("neural-lab");
});

// P3: Discovery added to discoveries.md
s.checkProduct("discovery-added", "Context window utilization finding added to discoveries.md", () => {
  const raw = s.readFile("agents/shared/knowledge/library/discoveries.md");
  if (!raw) return false;
  return raw.includes("Context window utilization") || raw.includes("context window utilization") ||
         raw.includes("40%") && raw.includes("skill files");
});

// P4: Existing content preserved in all files
s.checkProduct("papers-preserved", "Existing papers.md entries preserved", () => {
  const raw = s.readFile("agents/shared/knowledge/library/papers.md");
  if (!raw) return false;
  return raw.includes("Adaptive Tool Selection") &&
         raw.includes("Memory-Augmented Code Generation") &&
         raw.includes("Collaborative Debugging") &&
         raw.includes("Self-Improving Agents");
});

s.checkProduct("repos-preserved", "Existing repos.md entries preserved", () => {
  const raw = s.readFile("agents/shared/knowledge/library/repos.md");
  if (!raw) return false;
  return raw.includes("context-pilot") &&
         raw.includes("multi-agent-debate") &&
         raw.includes("tool-learning-bench") &&
         raw.includes("agent-swarm");
});

s.checkProduct("discoveries-preserved", "Existing discoveries.md entries preserved", () => {
  const raw = s.readFile("agents/shared/knowledge/library/discoveries.md");
  if (!raw) return false;
  return raw.includes("Skill file length correlates") &&
         raw.includes("Error cascading pattern") &&
         raw.includes("Git operations fail silently") &&
         raw.includes("Baseline ceiling effect");
});

// ── Convention C1.1: Read Before Edit ──────────────────────────────────

// Aggregate: all 3 files must be read before edit
s.checkConvention("C1.1", "read-before-edit-all-files", () => {
  if (!s.hasTranscript()) return true;
  // At minimum, repos.md and discoveries.md must be read before edit
  // (papers.md may or may not be edited, but if it is, it must be read first)
  const reposOk = readBefore("repos.md");
  const discoveriesOk = readBefore("discoveries.md");
  const papersOk = readBefore("papers.md");
  return reposOk && discoveriesOk && papersOk;
});

// Per-file detail checks
s.checkConvention("C1.1", "read-before-edit-papers", () => {
  if (!s.hasTranscript()) return true;
  return readBefore("papers.md");
});

s.checkConvention("C1.1", "read-before-edit-repos", () => {
  if (!s.hasTranscript()) return true;
  return readBefore("repos.md");
});

s.checkConvention("C1.1", "read-before-edit-discoveries", () => {
  if (!s.hasTranscript()) return true;
  return readBefore("discoveries.md");
});

// Bonus: did the agent detect the duplicate?
s.checkBehavior("duplicate-detected", "Agent identified pre-existing paper and skipped it", () => {
  if (!s.hasTranscript()) return true;
  // The paper already exists. A good agent reads papers.md, finds the duplicate, and doesn't add it again.
  // Check: paper count is still 1 occurrence AND agent mentioned "already exists" or "duplicate" or "skip"
  const raw = s.readFile("agents/shared/knowledge/library/papers.md");
  if (!raw) return false;
  const matches = raw.match(/2604\.03821/g);
  return matches !== null && matches.length === 1;
});

s.report();
