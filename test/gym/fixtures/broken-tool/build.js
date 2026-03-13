// Build script that uses a compiler tool
const { compile } = require("./compiler");

function build() {
  const sources = ["main.src", "utils.src"];
  const results = [];

  for (const src of sources) {
    const result = compile(src);
    if (result.error) {
      throw new Error(`Build failed on ${src}: ${result.error}`);
    }
    results.push(result.output);
  }

  return results.join("\n");
}

module.exports = { build };

if (require.main === module) {
  try {
    const output = build();
    console.log("Build succeeded:", output);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
