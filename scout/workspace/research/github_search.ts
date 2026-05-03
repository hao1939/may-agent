const fs = require('fs');

async function search() {
  const query = "multi-agent framework OR multi-agent orchestration created:>2024-01-01";
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js'
      }
    });
    const data = await res.json();
    const items = data.items.slice(0, 10).map(item => ({
      name: item.name,
      stars: item.stargazers_count,
      description: item.description
    }));
    
    fs.writeFileSync('agents/scout/workspace/research/github_results.json', JSON.stringify(items, null, 2));
    console.log("Results saved.");
  } catch (err) {
    console.error("Error:", err);
  }
}

search();
