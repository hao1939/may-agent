const fetch = require('node-fetch');

async function searchHn() {
  const query = "multi-agent framework OR agent evaluation OR agent error recovery";
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=15`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(JSON.stringify(data.hits.map(h => ({title: h.title, url: h.url, points: h.points, num_comments: h.num_comments})), null, 2));
  } catch (e) {
    console.error("Failed to fetch from HN:", e);
  }
}

searchHn();
