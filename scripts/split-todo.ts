#!/usr/bin/env bun
/**
 * split-todo.ts — Split bloated todo.md files into active priorities + archive.
 * 
 * Usage: bun scripts/split-todo.ts <path-to-todo.md>
 * 
 * Creates:
 *   - todo.md (rewritten with only active content)
 *   - todo-archive.md (completed/historical content)
 * 
 * Heuristics for "completed/archived" sections:
 *   - H2 sections starting with "## Completed" or "## ✅"
 *   - H3 sections with [COMPLETE ✅], [CANCELLED ❌], [CLOSED ✅], [VALIDATED ✅], [DEPLOYED ✅], [NULL RESULT]
 *   - H2 "## Session NNN" sections (session logs)
 *   - Items that are purely ✅ DONE entries in a list (within an active section, kept but collapsed)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: bun scripts/split-todo.ts <path-to-todo.md>");
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const content = readFileSync(filePath, "utf-8");
const lines = content.split("\n");

interface Section {
  header: string;
  headerLevel: number;
  lines: string[];
  isArchive: boolean;
}

// Parse into sections by H2/H3 headers
const sections: Section[] = [];
let preamble: string[] = []; // lines before first section header
let currentSection: Section | null = null;

for (const line of lines) {
  const h2Match = line.match(/^## (.+)/);
  const h3Match = line.match(/^### (.+)/);
  
  if (h2Match || h3Match) {
    if (currentSection) sections.push(currentSection);
    const header = (h2Match || h3Match)![1];
    const level = h2Match ? 2 : 3;
    currentSection = {
      header,
      headerLevel: level,
      lines: [line],
      isArchive: isArchiveSection(header, level),
    };
  } else if (currentSection) {
    currentSection.lines.push(line);
  } else {
    preamble.push(line);
  }
}
if (currentSection) sections.push(currentSection);

function isArchiveSection(header: string, level: number): boolean {
  const h = header.toLowerCase();
  
  // H2 "Completed" sections
  if (level === 2 && h.startsWith("completed")) return true;
  
  // H2 Session log sections (## Session NNN)
  if (level === 2 && /^session \d+/.test(h)) return true;
  
  // H2 "Archived" or "Archive" sections
  if (level === 2 && /^archived?\b/.test(h)) return true;
  
  // H2 "Counters" — repeated counter snapshots are historical
  if (level === 2 && h === "counters") return true;
  
  // H2 log/tracker sections (date-stamped rotation logs)
  if (level === 2 && /\btracker\b/.test(h)) return true;
  
  // H2 "Promoted Skills" — reference, not actionable
  if (level === 2 && /^promoted\b/.test(h)) return true;
  
  // H2 "Strategic Context" — background, not actionable
  if (level === 2 && /^strategic context/.test(h)) return true;
  
  // H3 with completion markers
  if (level === 3) {
    if (/\[complete\s*✅/.test(h)) return true;
    if (/\[cancelled\s*❌/.test(h)) return true;
    if (/\[closed\s*✅/.test(h)) return true;
    if (/\[validated\s*✅/.test(h)) return true;
    if (/\[deployed\s*✅/.test(h)) return true;
    if (/\[null result/.test(h)) return true;
    if (/^✅ done:/.test(h)) return true;
    // Completed experiments summary
    if (/^completed experiments/.test(h)) return true;
  }
  
  return false;
}

// Build active and archive content
const activeLines: string[] = [...preamble];
const archiveLines: string[] = [];

// Add archive header
const dir = dirname(filePath);
const base = basename(filePath, ".md");
const archivePath = join(dir, `${base}-archive.md`);

let archiveCount = 0;
let activeCount = 0;

for (const section of sections) {
  if (section.isArchive) {
    archiveLines.push(...section.lines);
    archiveCount++;
  } else {
    activeLines.push(...section.lines);
    activeCount++;
  }
}

// Only split if there's meaningful archive content
if (archiveCount === 0) {
  console.log(`No archive sections found in ${filePath}. Nothing to split.`);
  process.exit(0);
}

// Trim trailing blank lines from active content
while (activeLines.length > 0 && activeLines[activeLines.length - 1].trim() === "") {
  activeLines.pop();
}

// Add archive reference to active file
activeLines.push("");
activeLines.push(`---`);
activeLines.push(`*${archiveCount} completed/historical sections moved to [${base}-archive.md](./${base}-archive.md)*`);
activeLines.push("");

// Build archive file
const archiveHeader = [
  `# ${base.charAt(0).toUpperCase() + base.slice(1)} Archive`,
  ``,
  `*Completed and historical sections split from [${basename(filePath)}](./${basename(filePath)})*`,
  ``,
];

const archiveFinal = [...archiveHeader, ...archiveLines];

// Write files
const activeContent = activeLines.join("\n");
const archiveContent = archiveFinal.join("\n");

writeFileSync(filePath, activeContent);
writeFileSync(archivePath, archiveContent);

const originalLines = lines.length;
const newActiveLines = activeLines.length;
const newArchiveLines = archiveFinal.length;

console.log(`Split ${filePath}:`);
console.log(`  Original: ${originalLines} lines`);
console.log(`  Active:   ${newActiveLines} lines (${activeCount} sections)`);
console.log(`  Archive:  ${newArchiveLines} lines (${archiveCount} sections)`);
console.log(`  Reduction: ${Math.round((1 - newActiveLines / originalLines) * 100)}%`);
console.log(`  Archive written to: ${archivePath}`);
