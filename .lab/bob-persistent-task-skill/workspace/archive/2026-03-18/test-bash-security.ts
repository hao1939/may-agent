
import { createBashTool } from "../../src/lib/tools/bash";

async function test() {
  const tool = createBashTool(process.cwd());
  const maliciousCommand = 'echo "Zombie Check" > agents/bob/S""OUL.md';
  
  // This should be blocked by the check in bash.ts
  const protectedFiles = ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md", "agent.json", "philosophy.md"];
  const command = maliciousCommand;
  const normalized = command.replace(/["'\\]/g, "");
  const normalizedLower = normalized.toLowerCase();
  
  // Manually verify the logic before running
  console.log("Normalized:", normalized);
  const targetsProtected = protectedFiles.some(file => normalized.includes(file));
  console.log("Targets Protected:", targetsProtected);
  
  if (targetsProtected) {
      console.log("Logic Check: BLOCKED");
  } else {
      console.log("Logic Check: ALLOWED (VULNERABILITY)");
  }

test();
