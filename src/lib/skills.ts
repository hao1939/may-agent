import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

/** Parsed frontmatter from a markdown file. */
export interface Frontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/** A discovered skill with its name, description, and filesystem location. */
export interface SkillEntry {
  name: string;
  description: string;
  filePath: string;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Expects content starting with `---\n`, followed by YAML lines, closed by `---\n`.
 * Only handles simple `key: value` pairs (string values). Arrays and nested YAML are not supported.
 * @returns An object of key-value pairs from the YAML block, or an empty object if no valid frontmatter is found.
 * @param content - The raw markdown string to extract frontmatter from.
 */
export function parseFrontmatter(content: string): Frontmatter {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return {};

  // Find the closing ---
  const afterFirst = trimmed.indexOf("\n");
  if (afterFirst === -1) return {};

  const rest = trimmed.slice(afterFirst + 1);
  const closingIdx = rest.indexOf("\n---");
  if (closingIdx === -1) return {};

  const yamlBlock = rest.slice(0, closingIdx);
  const result: Frontmatter = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const colonIdx = trimmedLine.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmedLine.slice(0, colonIdx).trim();
    let value: string = trimmedLine.slice(colonIdx + 1).trim();

    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Scan directories for skill files.
 *
 * Discovery rules (matching pi's convention):
 * - Direct `.md` files in each directory root
 * - Recursive `SKILL.md` files in subdirectories
 * - Skip entries with no description in frontmatter
 */
export function loadSkillsFromDirs(dirs: string[]): SkillEntry[] {
  const skills: SkillEntry[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isFile() && entry.endsWith(".md")) {
        // Direct .md file in root
        const skill = tryLoadSkill(fullPath);
        if (skill) skills.push(skill);
      } else if (stat.isDirectory()) {
        // Recursively look for SKILL.md in subdirectories
        findSkillMdFiles(fullPath, skills);
      }
    }
  }

  return skills;
}

/** Recursively find SKILL.md files in a directory tree. */
function findSkillMdFiles(dir: string, skills: SkillEntry[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isFile() && entry === "SKILL.md") {
      const skill = tryLoadSkill(fullPath);
      if (skill) skills.push(skill);
    } else if (stat.isDirectory()) {
      findSkillMdFiles(fullPath, skills);
    }
  }
}

/** Try to load a skill from a markdown file. Returns null if no description. */
function tryLoadSkill(filePath: string): SkillEntry | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const fm = parseFrontmatter(content);
  if (!fm.description || typeof fm.description !== "string") return null;

  const name =
    typeof fm.name === "string" && fm.name
      ? fm.name
      : basename(filePath, ".md");

  return { name, description: fm.description, filePath };
}

/**
 * Format skills into an XML block for inclusion in system prompts.
 *
 * Output format:
 * ```xml
 * <available_skills>
 *   <skill>
 *     <name>skill-name</name>
 *     <description>Skill description.</description>
 *     <location>/path/to/SKILL.md</location>
 *   </skill>
 * </available_skills>
 * ```
 * @returns XML string of available skills, or empty string if no skills.
 */
export function formatSkillsForPrompt(skills: SkillEntry[]): string {
  if (skills.length === 0) return "";

  const entries = skills.map(
    (s) =>
      `  <skill>\n    <name>${escapeXml(s.name)}</name>\n    <description>${escapeXml(s.description)}</description>\n    <location>${escapeXml(s.filePath)}</location>\n  </skill>`,
  );

  return `<available_skills>\n${entries.join("\n")}\n</available_skills>`;
}

/** Escape basic XML special characters. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "\&apos;");
}

