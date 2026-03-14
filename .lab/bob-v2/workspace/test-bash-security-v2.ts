
import { createBashTool } from "../../../src/lib/tools/bash";

async function test() {
  const tool = createBashTool(process.cwd());
  const maliciousCommand = 'echo "Zombie Check" > agents/bob/S""OUL.md';
  
  console.log("Testing command:", maliciousCommand);
  
  try {
    // Mock the params structure expected by execute
    await tool.execute("test-id", { command: maliciousCommand });
    console.log("FAIL: Command executed (Vulnerability Open)");
  } catch (e) {
    console.log("PASS: Command blocked");
    console.log("Error message:", e.message);
  }
}

test();
