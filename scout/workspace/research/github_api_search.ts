const query = 'multi-agent coordination language:typescript created:>2024-01-01';
const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`;

fetch(url, {
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Scout-Research-Agent'
  }
})
.then(res => res.json())
.then(data => {
  if (data.items) {
    const repos = data.items.slice(0, 5).map((repo: any) => ({
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      url: repo.html_url
    }));
    console.log(JSON.stringify(repos, null, 2));
  } else {
    console.log('No items or error:', data);
  }
})
.catch(err => console.error('Error:', err));
