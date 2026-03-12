/**
 * Learn tool — may-agent-specific.
 * Records lessons to the agent's knowledge/lessons.md.
 */

import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const LearnParams: TSchema = Type.Object({
  lesson: Type.Optional(
    Type.String({ description: "What you learned. Be specific and actionable. Required when adding a lesson." }),
  ),
  category: Type.Optional(
    Type.String({
      description: "Category for the lesson (e.g. 'testing', 'architecture', 'debugging'). Default: 'general'.",
    }),
  ),
  listLessons: Type.Optional(
    Type.Boolean({
      description: "When true, return current lessons instead of adding. The 'lesson' param is ignored.",
    }),
  ),
});
interface LearnInput {
  lesson?: string;
  category?: string;
  listLessons?: boolean;
}

function parseLessons(content: string): Map<string, string[]> {
  const categories = new Map<string, string[]>();
  let currentCategory = "general";
  categories.set(currentCategory, []);

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentCategory = trimmed.slice(3).trim().toLowerCase();
      if (!categories.has(currentCategory)) {
        categories.set(currentCategory, []);
      }
    } else if (trimmed.startsWith("- ")) {
      const list = categories.get(currentCategory);
      if (list) list.push(trimmed);
      else categories.set(currentCategory, [trimmed]);
    }
  }

  return categories;
}

function serializeLessons(categories: Map<string, string[]>): string {
  const sections: string[] = ["# Lessons\n"];

  for (const [cat, lessons] of categories) {
    if (lessons.length === 0) continue;
    sections.push(`## ${cat}\n`);
    for (const lesson of lessons) {
      sections.push(lesson);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function isDuplicate(categories: Map<string, string[]>, lessonText: string): boolean {
  const needle = lessonText.toLowerCase();
  for (const lessons of categories.values()) {
    for (const existing of lessons) {
      const existingLower = existing.toLowerCase();
      const match = existingLower.match(/^- \d{4}-\d{2}-\d{2} \d{2}:\d{2}: (.+)$/);
      const existingText = match ? match[1] : existingLower;
      if (existingText.includes(needle) || needle.includes(existingText)) {
        return true;
      }
    }
  }
  return false;
}

export function createLearnTool(knowledgeDir: string): AgentTool {
  return {
    name: "learn",
    label: "Learn",
    description:
      "Record a lesson or list existing lessons. Use when: the user corrects you, you discover " +
      "something useful, or you find a better approach. Lessons persist " +
      "across sessions. Set listLessons=true to see what's already recorded. " +
      "Duplicate lessons are detected and skipped automatically.",
    parameters: LearnParams,
    execute: async (_id, _params) => {
      const params = _params as LearnInput;
      try {
        const lessonsPath = join(knowledgeDir, "lessons.md");
        mkdirSync(knowledgeDir, { recursive: true });

        if (params.listLessons) {
          if (!existsSync(lessonsPath)) {
            return textResult("No lessons recorded yet.");
          }
          const content = readFileSync(lessonsPath, "utf-8");
          return textResult(content);
        }

        if (!params.lesson) {
          return textResult("Error: 'lesson' parameter is required when adding a lesson.");
        }

        const category = (params.category ?? "general").toLowerCase().trim();
        const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
        const entry = `- ${ts}: ${params.lesson}`;

        let categories: Map<string, string[]>;
        if (existsSync(lessonsPath)) {
          const content = readFileSync(lessonsPath, "utf-8");
          categories = parseLessons(content);
        } else {
          categories = new Map();
        }

        if (isDuplicate(categories, params.lesson)) {
          return textResult("Lesson already exists (duplicate skipped).");
        }

        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(entry);

        writeFileSync(lessonsPath, serializeLessons(categories), "utf-8");

        return textResult("Lesson recorded.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}
