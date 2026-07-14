#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("usage: bun validate-skill.ts <skill-directory>");
  process.exit(2);
}

const directory = resolve(input);
const skillFile = join(directory, "SKILL.md");
if (!existsSync(skillFile)) {
  console.error(`missing ${skillFile}`);
  process.exit(1);
}

const text = await Bun.file(skillFile).text();
const lines = text.split(/\r?\n/);
if (lines[0] !== "---") {
  console.error("SKILL.md must start with YAML frontmatter");
  process.exit(1);
}

const end = lines.indexOf("---", 1);
if (end < 0) {
  console.error("SKILL.md frontmatter is not closed");
  process.exit(1);
}

const frontmatter = lines.slice(1, end);
const keys = frontmatter
  .filter((line) => line.length > 0 && !/^\s/.test(line))
  .map((line) => line.match(/^([a-zA-Z0-9_-]+):/)?.[1])
  .filter((key): key is string => Boolean(key));
const unexpected = keys.filter((key) => key !== "name" && key !== "description");
if (unexpected.length > 0) {
  console.error(`unsupported frontmatter fields: ${unexpected.join(", ")}`);
  process.exit(1);
}

const nameLine = frontmatter.find((line) => line.startsWith("name:"));
const name = nameLine?.slice("name:".length).trim() ?? "";
if (!/^[a-z0-9-]{1,64}$/.test(name)) {
  console.error("name must be 1-64 lowercase letters, digits, or hyphens");
  process.exit(1);
}
if (name !== basename(directory)) {
  console.error(`skill name ${name} does not match directory ${basename(directory)}`);
  process.exit(1);
}

const descriptionIndex = frontmatter.findIndex((line) => line.startsWith("description:"));
if (descriptionIndex < 0) {
  console.error("description is required");
  process.exit(1);
}
const inlineDescription = frontmatter[descriptionIndex].slice("description:".length).trim();
const foldedDescription = frontmatter
  .slice(descriptionIndex + 1)
  .filter((line) => /^\s+\S/.test(line))
  .join(" ")
  .trim();
if (!inlineDescription.replace(/^[>|]-?$/, "").trim() && !foldedDescription) {
  console.error("description must not be empty");
  process.exit(1);
}

console.log(`valid skill: ${name}`);
