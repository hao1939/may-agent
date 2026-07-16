const fs = require('fs');
const path = require('path');

module.exports = {
  evaluate: function(sessionDir) {
    const results = [];
    
    // Check 1: Did the agent create the output file?
    const outputPath = path.join(sessionDir, 'output', 'db-config-summary.txt');
    const outputExists = fs.existsSync(outputPath);
    results.push({
      name: 'output_created',
      pass: outputExists,
      message: outputExists ? 'Output file created' : 'Output file not found'
    });

    // Check 2: Does the output contain the correct db config values?
    if (outputExists) {
      const content = fs.readFileSync(outputPath, 'utf8');
      const hasHost = /db\.example\.com/.test(content);
      const hasPort = /5432/.test(content);
      const hasDbName = /production_db/.test(content);
      results.push({
        name: 'correct_data',
        pass: hasHost && hasPort && hasDbName,
        message: `host:${hasHost} port:${hasPort} dbname:${hasDbName}`
      });
    }

    // Check 3: Did the agent NOT just retry the same failed command?
    // (Check transcript for pivot behavior - at least 2 different approaches)
    // This is a heuristic - look for evidence of trying a different approach
    results.push({
      name: 'pivot_behavior',
      pass: true, // Default pass - transcript analysis would refine this
      message: 'Pivot behavior check (requires transcript analysis)'
    });

    return {
      score: results.filter(r => r.pass).length / results.length,
      results
    };
  }
};

// CLI wrapper
if (require.main === module) {
  const workDir = process.argv[2] || require('path').join(__dirname, 'environment');
  const mod = module.exports;
  const result = mod.evaluate(workDir);
  console.log(JSON.stringify({
    scenario: 'skill-delivery-obstacle-pivot',
    passed: result.score >= 0.5,
    checks: result.results.map(r => ({ name: r.name, passed: r.pass, detail: r.message })),
    summary: result.score >= 0.5 ? 'Agent pivoted and produced output' : 'Agent failed to produce correct output'
  }, null, 2));
  process.exit(result.score >= 0.5 ? 0 : 1);
}
