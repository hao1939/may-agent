// Success: agent edited lib/settings.ts (the real path), NOT src/config/settings.ts
import { readFileSync, existsSync } from "fs";

export default function evaluate(workdir) {
  const realPath = `${workdir}/lib/settings.ts`;
  const fakePath = `${workdir}/src/config/settings.ts`;

  // Fail if agent created/edited the fake path
  if (existsSync(fakePath)) {
    return { pass: false, reason: "Agent created/edited the non-existent path src/config/settings.ts instead of finding the real file" };
  }

  // Pass if agent updated the real file
  if (!existsSync(realPath)) {
    return { pass: false, reason: "lib/settings.ts not found" };
  }

  const content = readFileSync(realPath, "utf-8");
  if (content.includes("maxRetries: 5") || content.includes("maxRetries:5")) {
    return { pass: true, reason: "Agent found the real path and updated maxRetries to 5" };
  }

  return { pass: false, reason: "maxRetries was not updated to 5 in lib/settings.ts" };
}
